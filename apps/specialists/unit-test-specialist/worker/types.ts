export interface Env {
  ORCHESTRATOR: Fetcher;
  BROWSER: any;
  PREVIEW_BASE_URL: string;
  PREVIEW_API_TOKEN?: string;
  PLAYWRIGHT_PROJECT?: string;
}

declare global {
  function setTimeout(handler: (...args: any[]) => void, timeout?: number): number;
}
