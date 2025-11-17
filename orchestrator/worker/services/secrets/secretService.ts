/**
 * SecretService provides a secure interface for accessing sensitive credentials
 * from Cloudflare Workers environment variables. This service ensures that
 * sensitive data is never logged or exposed in error messages.
 */

export class SecretService {
  private readonly env: Env;
  private readonly requiredSecrets: Set<string>;

  constructor(env: Env) {
    this.env = env;
    this.requiredSecrets = new Set([
      'GITHUB_TOKEN',
      'JULES_API_KEY',
      'CODEX_API_KEY',
    ]);
  }

  /**
   * Retrieves a secret by key name
   * @param key The name of the secret to retrieve
   * @param required Whether this secret is required (throws if missing)
   * @returns The secret value or null if not found and not required
   */
  public getSecret(key: string, required: boolean = false): string | null {
    try {
      const value = this.env[key];
      if (value === undefined || value === null || value === '') {
        if (required) {
          throw new Error(`Required secret '${key}' is not configured`);
        }
        return null;
      }
      return value as string;
    } catch (error) {
      if (required) {
        throw error;
      }
      // Don't log the actual error to avoid exposing secret keys
      console.warn(`Failed to retrieve secret: ${key}`);
      return null;
    }
  }

  /**
   * Retrieves all API keys needed for LLM services
   * @returns Object containing all LLM API keys
   */
  public getLLMCredentials(): {
    jules?: string;
    codex?: string;
    gemini?: string;
    claude?: string;
    cursor?: string;
    github?: string;
    } {
    return {
      jules: this.getSecret('JULES_API_KEY'),
      codex: this.getSecret('CODEX_API_KEY'),
      gemini: this.getSecret('GEMINI_API_KEY'),
      claude: this.getSecret('CLAUDE_API_KEY'),
      cursor: this.getSecret('CURSOR_API_KEY'),
      github: this.getSecret('GITHUB_TOKEN'),
    };
  }

  /**
   * Retrieves database connection secrets
   * @returns Database connection configuration
   */
  public getDatabaseCredentials(): {
    host?: string;
    port?: string;
    database?: string;
    username?: string;
    password?: string;
    } {
    return {
      host: this.getSecret('DB_HOST'),
      port: this.getSecret('DB_PORT'),
      database: this.getSecret('DB_NAME'),
      username: this.getSecret('DB_USERNAME'),
      password: this.getSecret('DB_PASSWORD'),
    };
  }

  /**
   * Retrieves cloud service credentials
   * @returns Cloud service API keys and tokens
   */
  public getCloudCredentials(): {
    cloudflare?: string;
    aws?: string;
    gcp?: string;
    } {
    return {
      cloudflare: this.getSecret('CLOUDFLARE_API_KEY'),
      aws: this.getSecret('AWS_ACCESS_KEY_ID'),
      gcp: this.getSecret('GOOGLE_CLOUD_KEY'),
    };
  }

  /**
   * Validates that all required secrets are present
   * @throws Error if any required secret is missing
   */
  public validateRequiredSecrets(): void {
    const missingSecrets: string[] = [];

    for (const secret of this.requiredSecrets) {
      if (!this.getSecret(secret)) {
        missingSecrets.push(secret);
      }
    }

    if (missingSecrets.length > 0) {
      throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
    }
  }

  /**
   * Creates environment variables object for container injection
   * @param containerType The type of container being launched
   * @param additionalVars Additional environment variables to include
   * @returns Environment variables object safe for container injection
   */
  public createContainerEnvironment(
    containerType: 'cli-agent' | 'ai-provider' | 'git-ops',
    additionalVars: Record<string, string> = {},
  ): Record<string, string> {
    const baseEnv: Record<string, string> = {
      // Common environment variables
      NODE_ENV: this.env.NODE_ENV || 'production',
      LOG_LEVEL: this.env.LOG_LEVEL || 'info',
    };

    // Add container-specific environment variables
    switch (containerType) {
      case 'cli-agent':
        return {
          ...baseEnv,
          ...this.getCLIAgentEnvironment(),
          ...additionalVars,
        };

      case 'ai-provider':
        return {
          ...baseEnv,
          ...this.getAIProviderEnvironment(),
          ...additionalVars,
        };

      case 'git-ops':
        return {
          ...baseEnv,
          ...this.getGitOpsEnvironment(),
          ...additionalVars,
        };

      default:
        return {
          ...baseEnv,
          ...additionalVars,
        };
    }
  }

  /**
   * Gets environment variables for CLI agent containers
   */
  private getCLIAgentEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    // GitHub credentials for CLI operations
    const githubToken = this.getSecret('GITHUB_TOKEN');
    if (githubToken) {
      env.GITHUB_TOKEN = githubToken;
    }

    // SSH keys for git operations
    const sshKey = this.getSecret('SSH_PRIVATE_KEY');
    if (sshKey) {
      env.SSH_PRIVATE_KEY = sshKey;
    }

    // NPM token for package publishing
    const npmToken = this.getSecret('NPM_TOKEN');
    if (npmToken) {
      env.NPM_TOKEN = npmToken;
    }

    return env;
  }

  /**
   * Gets environment variables for AI provider containers
   */
  private getAIProviderEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    // LLM API keys
    const llmCreds = this.getLLMCredentials();
    if (llmCreds.jules) {
      env.JULES_API_KEY = llmCreds.jules;
    }
    if (llmCreds.codex) {
      env.CODEX_API_KEY = llmCreds.codex;
    }
    if (llmCreds.gemini) {
      env.GEMINI_API_KEY = llmCreds.gemini;
    }
    if (llmCreds.claude) {
      env.CLAUDE_API_KEY = llmCreds.claude;
    }
    if (llmCreds.cursor) {
      env.CURSOR_API_KEY = llmCreds.cursor;
    }

    // AI Gateway configuration
    const aiGateway = this.getSecret('AI_GATEWAY_URL');
    if (aiGateway) {
      env.AI_GATEWAY_URL = aiGateway;
    }

    return env;
  }

  /**
   * Gets environment variables for Git operations containers
   */
  private getGitOpsEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    // GitHub credentials
    const githubToken = this.getSecret('GITHUB_TOKEN');
    if (githubToken) {
      env.GITHUB_TOKEN = githubToken;
    }

    // Git configuration
    const gitUser = this.getSecret('GIT_USER_NAME');
    if (gitUser) {
      env.GIT_AUTHOR_NAME = gitUser;
      env.GIT_COMMITTER_NAME = gitUser;
    }

    const gitEmail = this.getSecret('GIT_USER_EMAIL');
    if (gitEmail) {
      env.GIT_AUTHOR_EMAIL = gitEmail;
      env.GIT_COMMITTER_EMAIL = gitEmail;
    }

    return env;
  }

  /**
   * Sanitizes environment variables for logging (removes sensitive values)
   * @param envVars Environment variables object
   * @returns Sanitized version safe for logging
   */
  public sanitizeForLogging(envVars: Record<string, string>): Record<string, string> {
    const sanitized = { ...envVars };
    const sensitiveKeys = [
      'API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE_KEY',
      'ACCESS_KEY', 'SECRET_KEY', 'CREDENTIALS',
    ];

    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (value && value.length > 50) {
        // Truncate long values
        sanitized[key] = value.substring(0, 50) + '...';
      }
    }

    return sanitized;
  }

  /**
   * Checks if a secret exists without retrieving its value
   * @param key The secret key to check
   * @returns True if the secret exists and has a value
   */
  public hasSecret(key: string): boolean {
    try {
      const value = this.env[key];
      return value !== undefined && value !== null && value !== '';
    } catch {
      return false;
    }
  }

  /**
   * Gets a list of all available secret keys (without values)
   * @returns Array of secret key names that exist
   */
  public listAvailableSecrets(): string[] {
    const availableSecrets: string[] = [];
    const possibleSecrets = [
      'GITHUB_TOKEN',
      'JULES_API_KEY',
      'CODEX_API_KEY',
      'GEMINI_API_KEY',
      'CLAUDE_API_KEY',
      'CURSOR_API_KEY',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USERNAME',
      'CLOUDFLARE_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'GOOGLE_CLOUD_KEY',
      'SSH_PRIVATE_KEY',
      'NPM_TOKEN',
      'AI_GATEWAY_URL',
      'GIT_USER_NAME',
      'GIT_USER_EMAIL',
    ];

    for (const secret of possibleSecrets) {
      if (this.hasSecret(secret)) {
        availableSecrets.push(secret);
      }
    }

    return availableSecrets;
  }
}
