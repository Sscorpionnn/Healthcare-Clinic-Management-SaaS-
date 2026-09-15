// Browser-visible API base URL. Server components/actions use API_URL
// (private) instead — see api-server.ts.
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_V1_PREFIX = "/api/v1";
