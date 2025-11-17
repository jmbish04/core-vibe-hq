// Empty instrumentation file for Cloudflare Workers compatibility
// This file prevents the "Dynamic require of instrumentation.js not supported" error
// when deploying to Cloudflare Workers via OpenNext

export function register() {
  // No instrumentation needed for Cloudflare Workers
  // This function exists to satisfy Next.js expectations
}
