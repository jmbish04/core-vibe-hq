/**
 * orchestrator/worker/clients/githubClient.ts
 * 
 * GitHub API client for interacting with repositories, files, and pull requests.
 * 
 * NOTE: This client is orchestrator-specific. Only the orchestrator has GitHub integration.
 * Apps workers should use the ORCHESTRATOR_GITHUB service binding to access GitHub operations.
 */

import type { CoreEnv } from '@shared/types/env'

export interface UpsertFileParams {
  owner: string
  repo: string
  path: string
  content: string
  message: string
  sha?: string
  branch?: string
}

export interface OpenPRParams {
  owner: string
  repo: string
  head: string
  base: string
  title: string
  body?: string
}

export interface UpsertFileResponse {
  commit: {
    sha: string
  }
  content?: {
    sha: string
    path: string
  }
}

export interface OpenPRResponse {
  html_url: string
  number: number
  id: number
}

export class GitHubClient {
  private env: CoreEnv
  private baseUrl: string

  constructor(env: CoreEnv) {
    this.env = env
    this.baseUrl = env.CORE_GITHUB_API || 'https://api.github.com'
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.env.GITHUB_API_KEY}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'core-vibe-hq-orchestrator',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  async upsertFile(params: UpsertFileParams): Promise<UpsertFileResponse> {
    const { owner, repo, path, content, message, sha, branch = 'main' } = params
    
    // Base64 encode the content
    const encodedContent = btoa(unescape(encodeURIComponent(content)))
    
    const body: any = {
      message,
      content: encodedContent,
      branch,
    }
    
    if (sha) {
      body.sha = sha
    }

    const endpoint = `/repos/${owner}/${repo}/contents/${path}`
    return this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async getFile(owner: string, repo: string, path: string, branch = 'main'): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    return this.makeRequest(endpoint)
  }

  async openPR(params: OpenPRParams): Promise<OpenPRResponse> {
    const { owner, repo, head, base, title, body } = params
    
    const endpoint = `/repos/${owner}/${repo}/pulls`
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        title,
        head,
        base,
        body: body || '',
      }),
    })
  }

  async createBranch(owner: string, repo: string, branchName: string, fromBranch = 'main'): Promise<any> {
    // Get the SHA of the source branch
    const refResponse = await this.makeRequest(`/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`)
    const sha = refResponse.object.sha

    // Create the new branch
    const endpoint = `/repos/${owner}/${repo}/git/refs`
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    })
  }

  async listBranches(owner: string, repo: string): Promise<any[]> {
    const endpoint = `/repos/${owner}/${repo}/branches`
    return this.makeRequest(endpoint)
  }
}

