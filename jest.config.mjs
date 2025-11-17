export default {
  testEnvironment: 'node',
  transform: {},
  haste: {
    computeSha1: true,
    throwOnModuleCollision: false
  },
  // Redirect relative imports used by the copied Task Master tests
  moduleNameMapper: {
    '^@tmstaging/(.*)$': '<rootDir>/STAGING/claude-task-master/$1',
    // Provide local stubs so resolution succeeds before jest.unstable_mockModule overrides them
    '^ai$': '<rootDir>/tests/_mocks/ai.js',
    '^ai-sdk-provider-codex-cli$': '<rootDir>/tests/_mocks/ai-sdk-provider-codex-cli.js'
  }
};
