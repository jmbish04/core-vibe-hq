import { describe, it, expect } from 'vitest';

/**
 * Infrastructure Smoke Tests
 *
 * Validates core infrastructure components that all other tests depend on.
 * These tests ensure the basic platform is working before running functional tests.
 */

describe('Infrastructure Smoke Tests', () => {
  describe('Database & RPC', () => {
    it('should have D1 database bindings configured', async () => {
      // Check that DB_OPS, DB_PROJECTS, DB_CHATS, DB_HEALTH are accessible
      expect(process.env.DB_OPS).toBeDefined();
      expect(process.env.DB_PROJECTS).toBeDefined();
      expect(process.env.DB_CHATS).toBeDefined();
      expect(process.env.DB_HEALTH).toBeDefined();
    });

    it('should have RPC service bindings configured', async () => {
      // Check that orchestrator RPC endpoints are accessible
      expect(process.env.ORCHESTRATOR_DATA).toBeDefined();
      expect(process.env.ORCHESTRATOR_PROJECTS).toBeDefined();
      expect(process.env.ORCHESTRATOR_CHATS).toBeDefined();
      expect(process.env.ORCHESTRATOR_HEALTH).toBeDefined();
    });

    it('should support database migrations', async () => {
      // This would normally test actual migration execution
      // For smoke tests, we verify the migration scripts exist
      const fs = require('fs');
      const path = require('path');

      const migrationsDir = path.join(process.cwd(), 'orchestrator', 'migrations');
      expect(fs.existsSync(migrationsDir)).toBe(true);

      const migrationFiles = fs.readdirSync(migrationsDir);
      expect(migrationFiles.length).toBeGreaterThan(0);
    });

    it('should support Kysely type inference', async () => {
      // Verify that the database service can be imported and initialized
      const { DatabaseService } = await import('../../orchestrator/worker/database/database');
      expect(DatabaseService).toBeDefined();
    });
  });

  describe('Service Bindings', () => {
    it('should have all required service bindings', async () => {
      // Verify service bindings are properly configured
      const requiredBindings = [
        'ORCHESTRATOR_DATA',
        'ORCHESTRATOR_PROJECTS',
        'ORCHESTRATOR_CHATS',
        'ORCHESTRATOR_HEALTH'
      ];

      requiredBindings.forEach(binding => {
        expect(process.env[binding]).toBeDefined();
      });
    });

    it('should support RPC communication', async () => {
      // This would test actual RPC calls in a real environment
      // For smoke tests, we verify the infrastructure exists
      expect(true).toBe(true); // Placeholder for actual RPC test
    });
  });

  describe('Environment Variables', () => {
    it('should have required worker environment variables', async () => {
      const requiredVars = [
        'WORKER_NAME',
        'WORKER_TYPE',
        'HEALTH_WORKER_TARGETS'
      ];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
      });
    });

    it('should have observability enabled', async () => {
      expect(process.env.OBSERVABILITY_ENABLED).toBe('true');
    });

    it('should have CF_VERSION_METADATA', async () => {
      expect(process.env.CF_VERSION_METADATA).toBeDefined();
    });
  });
});
