/**
 * Constructs an authorization URL for Descope OAuth.
 *
 * @param {Object} options
 * @param {string} options.project_id - The Descope project ID.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} [options.state] - The state parameter.
 *
 * @returns {string} The authorization URL.
 */
export function getDescopeAuthorizeUrl({
	project_id,
	redirect_uri,
	state,
}: {
	project_id: string;
	redirect_uri: string;
	state?: string;
}) {
	const upstream = new URL("https://api.descope.com/oauth2/v1/apps/authorize");
	upstream.searchParams.set("client_id", project_id);
	upstream.searchParams.set("redirect_uri", redirect_uri);
	upstream.searchParams.set("response_type", "code");
	if (state) upstream.searchParams.set("state", state);
	return upstream.href;
}

/**
 * Fetches an authorization token from Descope.
 *
 * @param {Object} options
 * @param {string} options.project_id - The Descope project ID.
 * @param {string} options.management_key - The Descope management key.
 * @param {string} options.code - The authorization code.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 *
 * @returns {Promise<[string, null] | [null, Response]>} A promise that resolves to an array containing the access token or an error response.
 */
export async function fetchDescopeAuthToken({
	project_id,
	management_key,
	code,
	redirect_uri,
}: {
	code: string | undefined;
	project_id: string;
	management_key: string;
	redirect_uri: string;
}): Promise<[string, null] | [null, Response]> {
	if (!code) {
		return [null, new Response("Missing code", { status: 400 })];
	}

	const resp = await fetch("https://api.descope.com/oauth2/v1/apps/token", {
		body: JSON.stringify({
			code,
			grant_type: "authorization_code",
			redirect_uri,
		}),
		headers: {
			Authorization: `Bearer ${project_id}:${management_key}`,
			"Content-Type": "application/json",
		},
		method: "POST",
	});

	if (!resp.ok) {
		const errorText = await resp.text();
		console.error("Descope token error:", errorText);
		return [null, new Response("Failed to fetch access token", { status: 500 })];
	}

	const body = await resp.json();
	const accessToken = body.access_token as string;
	if (!accessToken) {
		return [null, new Response("Missing access token", { status: 400 })];
	}
	return [accessToken, null];
}

/**
 * Fetches user information from Descope.
 *
 * @param {string} accessToken - The access token from Descope.
 *
 * @returns {Promise<DescopeUserInfo>} A promise that resolves to the user info.
 */
export async function getDescopeUserInfo(accessToken: string): Promise<DescopeUserInfo> {
	const resp = await fetch("https://api.descope.com/oauth2/v1/apps/userinfo", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		method: "GET",
	});

	if (!resp.ok) {
		throw new Error(`Failed to fetch user info: ${resp.statusText}`);
	}

	return resp.json();
}

export interface DescopeUserInfo {
	sub: string;
	name?: string;
	email?: string;
	picture?: string;
	phone?: string;
	[key: string]: any;
}

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
export type Props = {
	sub: string;
	name: string;
	email: string;
	accessToken: string;
};
