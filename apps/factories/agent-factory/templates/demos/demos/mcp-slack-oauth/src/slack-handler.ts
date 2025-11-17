import { env } from "cloudflare:workers";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { getUpstreamAuthorizeUrl } from "./utils";
import {
	addApprovedClient,
	bindStateToSession,
	createOAuthState,
	generateCSRFProtection,
	isClientApproved,
	OAuthError,
	renderApprovalDialog,
	validateCSRFToken,
	validateOAuthState,
} from "./workers-oauth-utils";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	userId: string;
	userName: string;
	teamId: string;
	teamName: string;
	accessToken: string;
	refreshToken: string;
	scope: string;
};

const app = new Hono<{
	Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers };
}>();

/**
 * OAuth Authorization Endpoint
 *
 * This route initiates the Slack OAuth flow when a user wants to log in.
 * It shows an approval dialog with client information and CSRF protection
 * before redirecting to Slack's authorization page.
 */
app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	// Check if client is already approved
	if (await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
		// Skip approval dialog but still create secure state and bind to session
		const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);
		return redirectToSlack(c.req.raw, stateToken, { "Set-Cookie": sessionBindingCookie });
	}

	// Generate CSRF protection for the approval form
	const { token: csrfToken, setCookie } = generateCSRFProtection();

	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		csrfToken,
		server: {
			description: "This MCP Server is a demo for Slack OAuth.",
			name: "Slack OAuth Demo",
		},
		setCookie,
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	try {
		// Read form data once
		const formData = await c.req.raw.formData();

		// Validate CSRF token
		validateCSRFToken(formData, c.req.raw);

		// Extract state from form data
		const encodedState = formData.get("state");
		if (!encodedState || typeof encodedState !== "string") {
			return c.text("Missing state in form data", 400);
		}

		let state: { oauthReqInfo?: AuthRequest };
		try {
			state = JSON.parse(atob(encodedState));
		} catch (_e) {
			return c.text("Invalid state data", 400);
		}

		if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
			return c.text("Invalid request", 400);
		}

		// Add client to approved list
		const approvedClientCookie = await addApprovedClient(
			c.req.raw,
			state.oauthReqInfo.clientId,
			c.env.COOKIE_ENCRYPTION_KEY,
		);

		// Create OAuth state and bind it to this user's session
		const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

		// Set both cookies: approved client list + session binding
		const headers = new Headers();
		headers.append("Set-Cookie", approvedClientCookie);
		headers.append("Set-Cookie", sessionBindingCookie);

		return redirectToSlack(c.req.raw, stateToken, Object.fromEntries(headers));
	} catch (error: any) {
		console.error("POST /authorize error:", error);
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		// Unexpected non-OAuth error
		return c.text(`Internal server error: ${error.message}`, 500);
	}
});

function redirectToSlack(
	request: Request,
	stateToken: string,
	headers: Record<string, string> = {},
) {
	return new Response(null, {
		headers: {
			...headers,
			location: getUpstreamAuthorizeUrl({
				client_id: env.SLACK_CLIENT_ID,
				redirect_uri: new URL("/callback", request.url).href,
				scope: "channels:history,channels:read,users:read",
				state: stateToken,
				upstream_url: "https://slack.com/oauth/v2/authorize",
			}),
		},
		status: 302,
	});
}

type SlackOauthTokenResponse =
	| {
			ok: true;
			app_id: string;
			authed_user: { id: string; name?: string };
			scope: string;
			token_type: string;
			access_token: string;
			bot_user_id: string;
			refresh_token: string;
			expires_in: number;
			team: { id: string; name: string };
	  }
	| {
			ok: false;
			error: string;
	  };

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from Slack after user authentication.
 * It validates the state parameter, exchanges the temporary code for an access token,
 * then stores user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 *
 * SECURITY: This endpoint validates that the state parameter from Slack
 * matches both:
 * 1. A valid state token in KV (proves it was created by our server)
 * 2. The __Host-CONSENTED_STATE cookie (proves THIS browser consented to it)
 *
 * This prevents CSRF attacks where an attacker's state token is injected
 * into a victim's OAuth flow.
 */
app.get("/callback", async (c) => {
	// Validate OAuth state with session binding
	// This checks both KV storage AND the session cookie
	let oauthReqInfo: AuthRequest;
	let clearSessionCookie: string;

	try {
		const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
		oauthReqInfo = result.oauthReqInfo;
		clearSessionCookie = result.clearCookie;
	} catch (error: any) {
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		// Unexpected non-OAuth error
		return c.text("Internal server error", 500);
	}

	if (!oauthReqInfo.clientId) {
		return c.text("Invalid OAuth request data", 400);
	}

	// Exchange the code for an access token
	const code = c.req.query("code");
	if (!code) {
		return c.text("Missing code", 400);
	}

	console.log("Attempting token exchange with params:", {
		code_exists: !!code,
		redirect_uri: new URL("/callback", c.req.url).href,
	});

	// Exchange the code for an access token
	const response = await fetch("https://slack.com/api/oauth.v2.access", {
		body: new URLSearchParams({
			client_id: c.env.SLACK_CLIENT_ID,
			client_secret: c.env.SLACK_CLIENT_SECRET,
			code,
			redirect_uri: new URL("/callback", c.req.url).href,
		}).toString(),
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		method: "POST",
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.log("Token exchange failed:", response.status, errorText);
		return c.text(`Failed to fetch access token: ${response.status} ${errorText}`, 500);
	}

	const data = (await response.json()) as SlackOauthTokenResponse;
	if (!data.ok) {
		console.log("Slack API error:", data.error);
		return c.text(`Slack API error: ${data.error || "Unknown error"}`, 500);
	}

	const accessToken = data.access_token;
	if (!accessToken) {
		return c.text("Missing access token", 400);
	}

	// Get user info from the Slack API response
	const userId = data.authed_user?.id || "unknown";
	const userName = data.authed_user?.name || "unknown";
	const teamId = data.team?.id || "unknown";
	const teamName = data.team?.name || "unknown";
	const scope = data.scope || "";

	console.log("Completing authorization with user:", userId);

	// Return back to the MCP client a new token
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		metadata: {
			label: userName,
		},
		// This will be available on this.props inside SlackMCP
		props: {
			accessToken,
			refreshToken: data.refresh_token,
			scope,
			teamId,
			teamName,
			userId,
			userName,
		} as Props,
		request: oauthReqInfo,
		scope: oauthReqInfo.scope,
		userId: userId,
	});

	// Clear the session binding cookie (one-time use) by creating response with headers
	const headers = new Headers({ Location: redirectTo });
	if (clearSessionCookie) {
		headers.set("Set-Cookie", clearSessionCookie);
	}

	return new Response(null, {
		status: 302,
		headers,
	});
});

export const SlackHandler = app;

export const refreshSlackToken = async (refresh_token: string): Promise<Partial<Props>> => {
	if (!refresh_token)
		throw new Error(
			`Cannot refresh Slack upstream token without refresh_token. Check your Slack OAuth app is set to use "token rotation".`,
		);

	const response = await fetch("https://slack.com/api/oauth.v2.access", {
		body: new URLSearchParams({
			client_id: env.SLACK_CLIENT_ID,
			client_secret: env.SLACK_CLIENT_SECRET,
			grant_type: "refresh_token",
			refresh_token,
		}).toString(),
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		method: "POST",
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.log("Token exchange failed:", response.status, errorText);
		throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
	}

	const data = (await response.json()) as SlackOauthTokenResponse;
	if (!data.ok) {
		console.log("Slack API error:", data.error);
		throw new Error(`Slack API error: ${data.error || "Unknown error"}`);
	}

	// Return the updated tokens to be stored in props
	return { accessToken: data.access_token, refreshToken: data.refresh_token };
};
