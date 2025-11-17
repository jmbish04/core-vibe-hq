/**
 * Git Service
 * Handles Git operations for conflict resolution
 */

export class GitService {
  private githubToken: string;
  private apiBase = 'https://api.github.com';

  constructor(githubToken: string) {
    this.githubToken = githubToken;
  }

  /**
   * Fetch PR diff to identify conflicts
   */
  async fetchPRDiff(repo: string, prNumber: number): Promise<string> {
    const [owner, repoName] = repo.split('/');
    const url = `${this.apiBase}/repos/${owner}/${repoName}/pulls/${prNumber}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3.diff',
        'User-Agent': 'Mission-Control-Conflict-Specialist'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PR diff: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Create a new branch for conflict resolution
   */
  async createResolutionBranch(
    repo: string,
    baseBranch: string,
    branchName: string
  ): Promise<void> {
    const [owner, repoName] = repo.split('/');
    
    // First, get the SHA of the base branch
    const refResponse = await fetch(
      `${this.apiBase}/repos/${owner}/${repoName}/git/ref/heads/${baseBranch}`,
      {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Mission-Control-Conflict-Specialist'
        }
      }
    );

    if (!refResponse.ok) {
      throw new Error(`Failed to fetch base branch: ${refResponse.statusText}`);
    }

    const refData = await refResponse.json() as { object: { sha: string } };
    const baseSha = refData.object.sha;

    // Create new branch
    const createResponse = await fetch(
      `${this.apiBase}/repos/${owner}/${repoName}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mission-Control-Conflict-Specialist'
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha
        })
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create branch: ${error}`);
    }
  }

  /**
   * Update file in repository
   */
  async updateFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<void> {
    const [owner, repoName] = repo.split('/');
    
    const response = await fetch(
      `${this.apiBase}/repos/${owner}/${repoName}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mission-Control-Conflict-Specialist'
        },
        body: JSON.stringify({
          message,
          content: btoa(content), // Base64 encode
          branch,
          sha // Required for updates
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update file: ${error}`);
    }
  }

  /**
   * Add comment to PR
   */
  async addPRComment(repo: string, prNumber: number, comment: string): Promise<void> {
    const [owner, repoName] = repo.split('/');
    
    const response = await fetch(
      `${this.apiBase}/repos/${owner}/${repoName}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mission-Control-Conflict-Specialist'
        },
        body: JSON.stringify({
          body: comment
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to add comment: ${error}`);
    }
  }
}

