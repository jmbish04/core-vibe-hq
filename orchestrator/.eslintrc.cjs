module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  globals: {
    // Cloudflare Workers globals
    Env: 'readonly',
    ExecutionContext: 'readonly',
    ExportedHandler: 'readonly',
    Fetcher: 'readonly',
    D1Database: 'readonly',
    KVNamespace: 'readonly',
    DurableObjectNamespace: 'readonly',
    DurableObjectState: 'readonly',
    DurableObjectStub: 'readonly',
    WebSocket: 'readonly',
    WebSocketPair: 'readonly',
    RequestInit: 'readonly',
    HeadersInit: 'readonly',
    Response: 'readonly',
    Request: 'readonly',
    FetchEvent: 'readonly',
    ScheduledEvent: 'readonly',
    Ai: 'readonly',
    AIGatewayProviders: 'readonly',
    RateLimit: 'readonly',
    caches: 'readonly',
    crypto: 'readonly',
    NodeJS: 'readonly',
    KVNamespacePutOptions: 'readonly',
    KVNamespaceListResult: 'readonly',
    KVNamespaceListKey: 'readonly',
    Cloudflare: 'readonly',
    AuthUser: 'readonly',
    Database: 'readonly',
    // Test globals
    describe: 'readonly',
    it: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly'
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'no-redeclare': 'error',
    'no-unreachable': 'error',
    'no-duplicate-case': 'error',
    'no-case-declarations': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-extra-semi': 'error',
    'no-useless-escape': 'error',
    'prefer-arrow-callback': 'error',
    'object-shorthand': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'comma-dangle': ['error', 'always-multiline'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'max-len': ['error', { code: 160, ignoreUrls: true, ignoreStrings: true, ignoreComments: true }],
    'no-trailing-spaces': 'error',
    'eol-last': 'error'
  },
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    '*.d.ts',
    'coverage/',
    '.wrangler/',
    'migrations/',
    'drizzle/',
    'scripts/',
    'public/',
    'third_party/',
    'src/',
    'tests/'
  ],
  overrides: [
    {
      files: ['worker/**/*.{ts,js}'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ]
    }
  ]
};
