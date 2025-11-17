// orchestrator/worker/integrations/github.ts

/**
 * Interface for environment variables required by the GitHub client.
 */
export interface GitHubClientEnv {
    /** The base URL for the GitHub API Worker, e.g., 'https://core-github-api.hacolby.workers.dev' */
    CORE_GITHUB_API_URL: string;
    /** The token used to authenticate with the GitHub API worker/backend. */
    GITHUB_WORKER_API_KEY: string;
}

// --- Type Definitions (Essential for Orchestrator Operations) ---

export interface GitHubOwner {
    login: string;
    id: number;
    type: 'User' | 'Organization';
}

export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner: GitHubOwner;
    description: string | null;
    default_branch: string;
}

export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    body: string | null;
    user: GitHubOwner;
    html_url: string;
}

export interface GitHubLabel {
    id: number;
    name: string;
    color: string;
    description: string | null;
}

export interface GitHubPullRequest {
    id: number;
    number: number;
    state: 'open' | 'closed';
    title: string;
    user: GitHubOwner;
    html_url: string;
    head: { ref: string; };
    base: { ref: string; };
    locked: boolean;
}

export interface GitHubComment {
    id: number;
    body: string;
    user: GitHubOwner;
    html_url: string;
}

export interface RepositoryPublicKey {
    key_id: string;
    key: string; // The public key
}

export interface WorkflowRun {
    id: number;
    name: string;
    head_branch: string;
    status: string; // 'completed', 'in_progress', 'queued'
    conclusion: string | null; // 'success', 'failure', 'cancelled'
    html_url: string;
    jobs_url: string;
}

export interface GitHubCommitStatus {
    state: 'error' | 'failure' | 'pending' | 'success';
    description: string;
    context: string;
    target_url?: string;
}

export interface BranchProtectionConfig {
    /** Require pull request reviews before merging */
    required_pull_request_reviews?: {
        dismiss_stale_reviews: boolean;
        require_code_owner_reviews: boolean;
        required_approving_review_count: number;
        // The orchestrator may not always need this, but it's a common option.
        dismissal_restrictions?: { users: string[], teams: string[] }; 
    };
    /** Require status checks to pass before merging */
    required_status_checks?: {
        strict: boolean;
        contexts: string[]; // List of status check names
    };
    /** Enforce all configured restrictions for administrators */
    enforce_admins: boolean;
    /** Restrict who can push to the protected branch */
    restrictions?: {
        users: string[]; // Users allowed to push (excluding admins)
        teams: string[]; // Teams allowed to push (excluding admins)
        apps?: string[]; // Apps allowed to push
    };
}

export interface WebhookConfig {
    url: string;
    content_type?: 'json' | 'form';
    secret?: string;
    insecure_ssl?: '0' | '1';
}

export interface Webhook {
    id: number;
    url: string;
    events: string[];
    active: boolean;
}

/**
 * Client for interacting with the core-github-api Cloudflare Worker.
 */
export class GitHubOrchestratorClient {
    private baseUrl: string;
    private token: string;

    constructor(env: GitHubClientEnv) {
        this.baseUrl = env.CORE_GITHUB_API_URL;
        this.token = env.GITHUB_WORKER_API_KEY;

        if (!this.token) {
            console.warn("GitHub API token is not set for GitHubOrchestratorClient. Some calls may fail.");
        }
    }

    /**
     * Generic fetch wrapper handling base URL, authorization, and error processing.
     */
    private async _fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
            ...(options.headers || {})
        };

        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `GitHub API Request Failed [${response.status} ${response.statusText}] for ${endpoint}`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message) errorMessage += `: ${errorJson.message}`;
            } catch {
                errorMessage += ` (Raw body: ${errorText.substring(0, 100)}...)`;
            }
            throw new Error(errorMessage);
        }

        // Handle 204 No Content
        if (response.status === 204 || (response.headers.get('content-length') === '0' && response.status !== 200)) {
            return null as T;
        }

        return response.json() as Promise<T>;
    }

// -------------------------------------------------------------------
// 📂 REPOSITORY MANAGEMENT
// -------------------------------------------------------------------

    /**
     * Creates a new repository for the authenticated user or organization.
     */
    public async createRepository(
        name: string,
        isPrivate: boolean = true,
        description: string = '',
        org?: string, // If provided, creates under the organization
    ): Promise<GitHubRepository> {
        const endpoint = org ? `/orgs/${org}/repos` : '/user/repos';
        return this._fetch<GitHubRepository>(endpoint, {
            method: 'POST',
            body: JSON.stringify({ name, private: isPrivate, description }),
        });
    }

    /**
     * Updates settings (description, private status, etc.) of an existing repository.
     */
    public async updateRepository(
        owner: string,
        repo: string,
        updates: { name?: string, description?: string, private?: boolean, default_branch?: string },
    ): Promise<GitHubRepository> {
        return this._fetch<GitHubRepository>(`/repos/${owner}/${repo}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Lists all repositories for the specified organization.
     */
    public async listRepositoriesForOrg(org: string): Promise<GitHubRepository[]> {
        return this._fetch<GitHubRepository[]>(`/orgs/${org}/repos`);
    }

// -------------------------------------------------------------------
// 🌳 CATEGORY #1: GIT DATA OPERATIONS (BRANCHES & TAGS)
// -------------------------------------------------------------------

    /**
     * Creates a new Git Reference (e.g., a branch or a tag).
     * @param ref The Git reference to create (e.g., 'refs/heads/new-feature').
     * @param sha The SHA1 value to point the reference to.
     */
    public async createGitRef(owner: string, repo: string, ref: string, sha: string): Promise<{ ref: string; node_id: string; url: string; object: { sha: string; type: string; url: string } }> {
        return this._fetch<{ ref: string; node_id: string; url: string; object: { sha: string; type: string; url: string } }>(`/repos/${owner}/${repo}/git/refs`, {
            method: 'POST',
            body: JSON.stringify({ ref, sha }),
        });
    }

    /**
     * Deletes a Git Reference (e.g., a branch or a tag).
     * @param ref The full reference path (e.g., 'heads/feature-branch' or 'tags/v1.0.0').
     */
    public async deleteGitRef(owner: string, repo: string, ref: string): Promise<void> {
        await this._fetch<void>(`/repos/${owner}/${repo}/git/refs/${ref}`, {
            method: 'DELETE',
        });
    }

    /**
     * Retrieves information about a single Git Reference.
     * @param ref The full reference path (e.g., 'heads/main').
     */
    public async getGitRef(owner: string, repo: string, ref: string): Promise<{ ref: string; node_id: string; url: string; object: { sha: string; type: string; url: string } }> {
        return this._fetch<{ ref: string; node_id: string; url: string; object: { sha: string; type: string; url: string } }>(`/repos/${owner}/${repo}/git/refs/${ref}`);
    }

    /**
     * Lists all tags for the repository.
     */
    public async listTags(owner: string, repo: string): Promise<Array<{ name: string; zipball_url: string; tarball_url: string; commit: { sha: string; url: string } }>> {
        return this._fetch<Array<{ name: string; zipball_url: string; tarball_url: string; commit: { sha: string; url: string } }>>(`/repos/${owner}/${repo}/tags`);
    }

// -------------------------------------------------------------------
// 🔒 CATEGORY #2: REPOSITORY CONFIGURATION (PROTECTION, WEBHOOKS, TOPICS)
// -------------------------------------------------------------------

    /**
     * Enforces protection on a branch. Used to lock down critical branches like 'main'.
     */
    public async setBranchProtection(owner: string, repo: string, branch: string, config: BranchProtectionConfig): Promise<BranchProtectionConfig> {
        return this._fetch<BranchProtectionConfig>(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
            method: 'PUT',
            body: JSON.stringify(config),
        });
    }

    /**
     * Deletes branch protection for a branch.
     */
    public async deleteBranchProtection(owner: string, repo: string, branch: string): Promise<void> {
        await this._fetch<void>(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
            method: 'DELETE',
        });
    }

    /**
     * Creates a new Webhook for the repository.
     * @param name Must be 'web'.
     * @param events The list of events to subscribe to (e.g., ['push', 'pull_request']).
     */
    public async createWebhook(owner: string, repo: string, name: 'web', config: WebhookConfig, events: string[] = ['push']): Promise<Webhook> {
        return this._fetch<Webhook>(`/repos/${owner}/${repo}/hooks`, {
            method: 'POST',
            body: JSON.stringify({ name, config, events, active: true }),
        });
    }

    /**
     * Replaces all topics for a repository.
     */
    public async replaceAllTopics(owner: string, repo: string, topics: string[]): Promise<{ names: string[] }> {
        return this._fetch<{ names: string[] }>(`/repos/${owner}/${repo}/topics`, {
            method: 'PUT',
            headers: { 
                'Accept': 'application/vnd.github.mercy-preview+json', // Required for Topics API
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
            },
            body: JSON.stringify({ names: topics }),
        });
    }

// -------------------------------------------------------------------
// 🚦 CATEGORY #3: CI/CD STATUS AND LIFECYCLE MANAGEMENT
// -------------------------------------------------------------------

    /**
     * Sets a commit status for a given SHA. Used to report external CI/CD tool results.
     * @param sha The SHA of the commit to update.
     * @param status The status object containing state, description, and context.
     */
    public async setCommitStatus(owner: string, repo: string, sha: string, status: GitHubCommitStatus): Promise<GitHubCommitStatus> {
        return this._fetch<GitHubCommitStatus>(`/repos/${owner}/${repo}/statuses/${sha}`, {
            method: 'POST',
            body: JSON.stringify(status),
        });
    }

    /**
     * Creates a new GitHub Release.
     * @param tagName The tag for the release (must already exist or be created).
     */
    public async createRelease(
        owner: string,
        repo: string,
        tagName: string,
        name: string,
        body: string = '',
        draft: boolean = false,
        prerelease: boolean = false,
    ): Promise<{ id: number; tag_name: string; name: string; body: string; draft: boolean; prerelease: boolean; html_url: string }> {
        return this._fetch<{ id: number; tag_name: string; name: string; body: string; draft: boolean; prerelease: boolean; html_url: string }>(`/repos/${owner}/${repo}/releases`, {
            method: 'POST',
            body: JSON.stringify({ tag_name: tagName, name, body, draft, prerelease }),
        });
    }

// -------------------------------------------------------------------
// 🛠️ ISSUES AND ISSUE COMMENTS
// -------------------------------------------------------------------

    /**
     * Lists all issues for a repository.
     */
    public async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
        return this._fetch<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=${state}`);
    }

    /**
     * Creates a new issue.
     */
    public async createIssue(owner: string, repo: string, title: string, body: string, labels: string[] = []): Promise<GitHubIssue> {
        return this._fetch<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
            method: 'POST',
            body: JSON.stringify({ title, body, labels }),
        });
    }

    /**
     * Updates an existing issue (including setting its state to closed).
     */
    public async updateIssue(owner: string, repo: string, issueNumber: number, updates: { title?: string, body?: string, state?: 'open' | 'closed' }): Promise<GitHubIssue> {
        return this._fetch<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Adds a general comment to an issue.
     */
    public async createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<GitHubComment> {
        return this._fetch<GitHubComment>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body }),
        });
    }

    /**
     * Lists comments on an issue.
     */
    public async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubComment[]> {
        return this._fetch<GitHubComment[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
    }

// -------------------------------------------------------------------
// 🏷️ CATEGORY #4: ISSUE & PR TRIAGE COMPONENTS
// -------------------------------------------------------------------

    /**
     * Lists all labels for a repository.
     */
    public async listLabels(owner: string, repo: string): Promise<GitHubLabel[]> {
        return this._fetch<GitHubLabel[]>(`/repos/${owner}/${repo}/labels`);
    }

    /**
     * Creates a new label.
     * @param color The hex color code without the '#'.
     */
    public async createLabel(owner: string, repo: string, name: string, color: string, description: string): Promise<GitHubLabel> {
        return this._fetch<GitHubLabel>(`/repos/${owner}/${repo}/labels`, {
            method: 'POST',
            body: JSON.stringify({ name, color, description }),
        });
    }

    /**
     * Updates an existing label.
     */
    public async updateLabel(owner: string, repo: string, currentName: string, newName: string, color: string, description: string): Promise<GitHubLabel> {
        return this._fetch<GitHubLabel>(`/repos/${owner}/${repo}/labels/${currentName}`, {
            method: 'PATCH',
            body: JSON.stringify({ new_name: newName, color, description }),
        });
    }

    /**
     * Adds labels to an issue or pull request.
     */
    public async addLabelsToIssue(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<GitHubLabel[]> {
        return this._fetch<GitHubLabel[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
            method: 'POST',
            body: JSON.stringify(labels),
        });
    }

    /**
     * Removes a single label from an issue or pull request.
     */
    public async removeLabelFromIssue(owner: string, repo: string, issueNumber: number, name: string): Promise<GitHubLabel[]> {
        return this._fetch<GitHubLabel[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${name}`, {
            method: 'DELETE',
        });
    }

    /**
     * Sets the assignees for an issue or pull request, replacing all existing ones.
     */
    public async setAssignees(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<GitHubIssue> {
        return this._fetch<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
            method: 'POST',
            body: JSON.stringify({ assignees }),
        });
    }

// -------------------------------------------------------------------
// 🏗️ PULL REQUESTS AND CODE COMMENTS
// -------------------------------------------------------------------

    /**
     * Lists all pull requests for a repository.
     */
    public async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
        return this._fetch<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=${state}`);
    }

    /**
     * Creates a pull request.
     */
    public async createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body: string = ''): Promise<GitHubPullRequest> {
        return this._fetch<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            body: JSON.stringify({ title, head, base, body }),
        });
    }

    /**
     * Updates an existing pull request (e.g., changing the title or setting state to closed/merged).
     */
    public async updatePullRequest(owner: string, repo: string, prNumber: number, updates: { title?: string, body?: string, state?: 'open' | 'closed' }): Promise<GitHubPullRequest> {
        return this._fetch<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Creates a line-level code comment on a Pull Request.
     * @param body The comment body.
     * @param commitId The SHA of the commit to comment on.
     * @param path The file path to comment on.
     * @param position The line number or position within the diff to comment on.
     */
    public async createPullRequestReviewComment(
        owner: string,
        repo: string,
        prNumber: number,
        body: string,
        commitId: string,
        path: string,
        position: number,
    ): Promise<GitHubComment> {
        return this._fetch<GitHubComment>(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body, commit_id: commitId, path, position }),
        });
    }

    /**
     * Lists review comments on a Pull Request.
     */
    public async listPullRequestComments(owner: string, repo: string, prNumber: number): Promise<GitHubComment[]> {
        return this._fetch<GitHubComment[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`);
    }

    /**
     * Replies to an existing pull request review comment (nested comment).
     */
    public async replyToPullRequestComment(
        owner: string,
        repo: string,
        prNumber: number,
        commentId: number,
        body: string
    ): Promise<GitHubComment> {
        return this._fetch<GitHubComment>(`/repos/${owner}/${repo}/pulls/${prNumber}/comments/${commentId}/replies`, {
            method: 'POST',
            body: JSON.stringify({ body }),
        });
    }

// -------------------------------------------------------------------
// 🔑 REPOSITORY ACTIONS SECRETS MANAGEMENT
// -------------------------------------------------------------------

    /**
     * Gets the public key required to encrypt secrets for a repository.
     */
    public async getRepositoryPublicKey(owner: string, repo: string): Promise<RepositoryPublicKey> {
        return this._fetch<RepositoryPublicKey>(`/repos/${owner}/${repo}/actions/secrets/public-key`);
    }

    /**
     * Creates or updates a repository secret. The secret value *must* be encrypted
     * using the public key retrieved from `getRepositoryPublicKey`.
     * The orchestrator's agent logic must handle the encryption step (e.g., using libsodium).
     * @param encryptedValue The Base64-encoded, encrypted secret value.
     * @param keyId The ID of the public key used for encryption.
     */
    public async createOrUpdateRepositorySecret(
        owner: string,
        repo: string,
        secretName: string,
        encryptedValue: string,
        keyId: string,
    ): Promise<void> {
        await this._fetch<void>(`/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
            method: 'PUT',
            body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId }),
        });
    }

    /**
     * Lists all secrets for a repository.
     */
    public async listRepositorySecrets(owner: string, repo: string): Promise<{ secrets: { name: string, created_at: string, updated_at: string }[] }> {
        return this._fetch<{ secrets: { name: string, created_at: string, updated_at: string }[] }>(`/repos/${owner}/${repo}/actions/secrets`);
    }

    /**
     * Deletes a secret from a repository.
     */
    public async deleteRepositorySecret(owner: string, repo: string, secretName: string): Promise<void> {
        await this._fetch<void>(`/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
            method: 'DELETE',
        });
    }

// -------------------------------------------------------------------
// 🚀 GITHUB ACTIONS & WORKFLOW RUNS
// -------------------------------------------------------------------

    /**
     * Triggers a workflow run using the Dispatch method. (Needs 'workflow_dispatch' event configured)
     * This is crucial for your full-auto Codex infrastructure strategy.
     */
    public async triggerWorkflowDispatch(
        owner: string,
        repo: string,
        workflowId: string | number, // The ID or file name (e.g., 'meta-deploy.yml')
        ref: string = 'main',
        inputs: Record<string, unknown> = {},
    ): Promise<void> {
        const endpoint = `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
        await this._fetch<void>(endpoint, {
            method: 'POST',
            body: JSON.stringify({ ref, inputs }),
        });
    }

    /**
     * Lists workflow runs for a repository.
     */
    public async listWorkflowRuns(owner: string, repo: string, branch?: string): Promise<{ total_count: number, workflow_runs: WorkflowRun[] }> {
        let endpoint = `/repos/${owner}/${repo}/actions/runs`;
        if (branch) {
            endpoint += `?branch=${branch}`;
        }
        return this._fetch<{ total_count: number, workflow_runs: WorkflowRun[] }>(endpoint);
    }

    /**
     * Gets the log file as a raw string for a specific workflow run.
     * @param runId The ID of the workflow run.
     * @returns A string containing the log content.
     */
    public async getWorkflowRunLogs(owner: string, repo: string, runId: number): Promise<string> {
        // This endpoint returns a temporary redirect to the log archive, use the original URL
        const url = `${this.baseUrl}/repos/${owner}/${repo}/actions/runs/${runId}/logs`;

        // We must perform a raw fetch here as the response is not JSON (it's a ZIP archive).
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to retrieve workflow run logs: ${response.status} ${response.statusText}`);
        }

        // This returns a ZIP file. For simplicity in a worker, we'll return the URL of the redirect
        // or a descriptive message, as ZIP processing is complex in a basic fetch.
        // For a full system, you would stream, unzip, and read the logs.
        if (response.headers.get('content-type') === 'application/zip') {
            // Redirects often have response.status = 200, but the final content is a ZIP
            // For a simple response, we can just return a log that points to the data.
            return `LOGS_ZIP_ARCHIVE_RECEIVED_FOR_RUN_${runId}: You must use a streaming/unzip tool to process this content.`;
        }

        // Fallback for non-zip content, possibly an error or a short log.
        return response.text();
    }
}