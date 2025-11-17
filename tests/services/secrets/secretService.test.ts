import { SecretService } from '../../../orchestrator/worker/services/secrets/secretService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SecretService', () => {
  let secretService: SecretService;
  let mockEnv: any;

  beforeEach(() => {
    // Mock environment with test secrets
    mockEnv = {
      JULES_API_KEY: 'test-jules-key',
      CODEX_API_KEY: 'test-codex-key',
      GEMINI_API_KEY: 'test-gemini-key',
      CLAUDE_API_KEY: 'test-claude-key',
      CURSOR_API_KEY: 'test-cursor-key',
      GITHUB_TOKEN: 'test-github-token',
      DB_HOST: 'test-db-host',
      DB_PORT: '5432',
      DB_NAME: 'test-db',
      DB_USERNAME: 'test-user',
      CLOUDFLARE_API_KEY: 'test-cf-key',
      AWS_ACCESS_KEY_ID: 'test-aws-key',
      SSH_PRIVATE_KEY: 'test-ssh-key',
      NPM_TOKEN: 'test-npm-token',
      AI_GATEWAY_URL: 'https://gateway.example.com',
      GIT_USER_NAME: 'Test User',
      GIT_USER_EMAIL: 'test@example.com',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug'
    };

    secretService = new SecretService(mockEnv);
  });

  describe('getSecret', () => {
    it('should retrieve a secret by key', () => {
      expect(secretService.getSecret('JULES_API_KEY')).toBe('test-jules-key');
      expect(secretService.getSecret('GITHUB_TOKEN')).toBe('test-github-token');
    });

    it('should return null for non-existent secrets', () => {
      expect(secretService.getSecret('NON_EXISTENT_KEY')).toBeNull();
    });

    it('should return null for empty secrets', () => {
      mockEnv.EMPTY_SECRET = '';
      expect(secretService.getSecret('EMPTY_SECRET')).toBeNull();
    });

    it('should throw error for required missing secrets', () => {
      expect(() => {
        secretService.getSecret('NON_EXISTENT_KEY', true);
      }).toThrow('Required secret \'NON_EXISTENT_KEY\' is not configured');
    });

    it('should handle undefined secrets', () => {
      mockEnv.UNDEFINED_SECRET = undefined;
      expect(secretService.getSecret('UNDEFINED_SECRET')).toBeNull();
    });
  });

  describe('getLLMCredentials', () => {
    it('should retrieve all LLM credentials', () => {
      const creds = secretService.getLLMCredentials();

      expect(creds).toEqual({
        jules: 'test-jules-key',
        codex: 'test-codex-key',
        gemini: 'test-gemini-key',
        claude: 'test-claude-key',
        cursor: 'test-cursor-key',
        github: 'test-github-token'
      });
    });

    it('should handle missing LLM credentials', () => {
      const minimalEnv = { GITHUB_TOKEN: 'test-token' };
      const minimalService = new SecretService(minimalEnv);
      const creds = minimalService.getLLMCredentials();

      expect(creds).toEqual({
        jules: null,
        codex: null,
        gemini: null,
        claude: null,
        cursor: null,
        github: 'test-token'
      });
    });
  });

  describe('getDatabaseCredentials', () => {
    it('should retrieve database credentials', () => {
      const creds = secretService.getDatabaseCredentials();

      expect(creds).toEqual({
        host: 'test-db-host',
        port: '5432',
        database: 'test-db',
        username: 'test-user',
        password: null // DB_PASSWORD not set
      });
    });
  });

  describe('getCloudCredentials', () => {
    it('should retrieve cloud service credentials', () => {
      const creds = secretService.getCloudCredentials();

      expect(creds).toEqual({
        cloudflare: 'test-cf-key',
        aws: 'test-aws-key',
        gcp: null // GOOGLE_CLOUD_KEY not set
      });
    });
  });

  describe('validateRequiredSecrets', () => {
    it('should pass when all required secrets are present', () => {
      expect(() => {
        secretService.validateRequiredSecrets();
      }).not.toThrow();
    });

    it('should throw error when required secrets are missing', () => {
      const minimalEnv = {}; // Missing all required secrets
      const minimalService = new SecretService(minimalEnv);

      expect(() => {
        minimalService.validateRequiredSecrets();
      }).toThrow('Missing required secrets: GITHUB_TOKEN, JULES_API_KEY, CODEX_API_KEY');
    });
  });

  describe('createContainerEnvironment', () => {
    it('should create environment for CLI agent containers', () => {
      const env = secretService.createContainerEnvironment('cli-agent', { CUSTOM_VAR: 'value' });

      expect(env).toEqual({
        NODE_ENV: 'test',
        LOG_LEVEL: 'debug',
        GITHUB_TOKEN: 'test-github-token',
        SSH_PRIVATE_KEY: 'test-ssh-key',
        NPM_TOKEN: 'test-npm-token',
        CUSTOM_VAR: 'value'
      });
    });

    it('should create environment for AI provider containers', () => {
      const env = secretService.createContainerEnvironment('ai-provider', { MODEL: 'gpt-4' });

      expect(env).toEqual({
        NODE_ENV: 'test',
        LOG_LEVEL: 'debug',
        JULES_API_KEY: 'test-jules-key',
        CODEX_API_KEY: 'test-codex-key',
        GEMINI_API_KEY: 'test-gemini-key',
        CLAUDE_API_KEY: 'test-claude-key',
        CURSOR_API_KEY: 'test-cursor-key',
        AI_GATEWAY_URL: 'https://gateway.example.com',
        MODEL: 'gpt-4'
      });
    });

    it('should create environment for Git ops containers', () => {
      const env = secretService.createContainerEnvironment('git-ops');

      expect(env).toEqual({
        NODE_ENV: 'test',
        LOG_LEVEL: 'debug',
        GITHUB_TOKEN: 'test-github-token',
        GIT_AUTHOR_NAME: 'Test User',
        GIT_COMMITTER_NAME: 'Test User',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      });
    });

    it('should handle missing optional secrets gracefully', () => {
      const minimalEnv = {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      };
      const minimalService = new SecretService(minimalEnv);

      const env = minimalService.createContainerEnvironment('cli-agent');

      expect(env).toEqual({
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
        // No GitHub token or other secrets
      });
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact sensitive environment variables', () => {
      const envVars = {
        API_KEY: 'secret-key',
        TOKEN: 'secret-token',
        PASSWORD: 'secret-password',
        PRIVATE_KEY: 'secret-private-key',
        ACCESS_KEY: 'secret-access-key',
        SECRET_KEY: 'secret-secret-key',
        CREDENTIALS: 'secret-credentials',
        NORMAL_VAR: 'normal-value',
        LONG_VALUE: 'a'.repeat(60)
      };

      const sanitized = secretService.sanitizeForLogging(envVars);

      expect(sanitized).toEqual({
        API_KEY: '[REDACTED]',
        TOKEN: '[REDACTED]',
        PASSWORD: '[REDACTED]',
        PRIVATE_KEY: '[REDACTED]',
        ACCESS_KEY: '[REDACTED]',
        SECRET_KEY: '[REDACTED]',
        CREDENTIALS: '[REDACTED]',
        NORMAL_VAR: 'normal-value',
        LONG_VALUE: 'a'.repeat(50) + '...'
      });
    });
  });

  describe('hasSecret', () => {
    it('should return true for existing secrets', () => {
      expect(secretService.hasSecret('JULES_API_KEY')).toBe(true);
      expect(secretService.hasSecret('GITHUB_TOKEN')).toBe(true);
    });

    it('should return false for non-existent secrets', () => {
      expect(secretService.hasSecret('NON_EXISTENT')).toBe(false);
    });

    it('should return false for empty secrets', () => {
      mockEnv.EMPTY_SECRET = '';
      expect(secretService.hasSecret('EMPTY_SECRET')).toBe(false);
    });
  });

  describe('listAvailableSecrets', () => {
    it('should return list of available secrets', () => {
      const available = secretService.listAvailableSecrets();

      expect(available).toContain('JULES_API_KEY');
      expect(available).toContain('GITHUB_TOKEN');
      expect(available).toContain('DB_HOST');
      expect(available).toContain('CLOUDFLARE_API_KEY');
      expect(available).toContain('SSH_PRIVATE_KEY');
      expect(available).toContain('AI_GATEWAY_URL');
      expect(available).toContain('GIT_USER_NAME');

      expect(available).not.toContain('NON_EXISTENT');
      expect(available).not.toContain('DB_PASSWORD'); // Not set in mockEnv
    });
  });

  describe('Error Handling', () => {
    it('should handle environment access errors gracefully', () => {
      // Mock an environment that throws on property access
      const errorEnv = new Proxy({}, {
        get() {
          throw new Error('Environment access denied');
        }
      });

      const errorService = new SecretService(errorEnv as any);

      expect(errorService.getSecret('ANY_KEY')).toBeNull();
      expect(errorService.hasSecret('ANY_KEY')).toBe(false);
    });

    it('should not expose sensitive data in error messages', () => {
      const errorEnv = new Proxy(mockEnv, {
        get(target, prop) {
          if (prop === 'ERROR_SECRET') {
            throw new Error('Secret contains sensitive data: super-secret-key');
          }
          return target[prop as keyof typeof target];
        }
      });

      const errorService = new SecretService(errorEnv as any);

      // Should not throw the original error with sensitive data
      expect(errorService.getSecret('ERROR_SECRET')).toBeNull();
    });
  });
});
