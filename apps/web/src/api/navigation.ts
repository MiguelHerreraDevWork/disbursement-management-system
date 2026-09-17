// Decouples the API client from the router: client.ts needs to force a
// navigation to /login on 401, but importing the router singleton directly
// would create a cycle (router -> route pages -> auth context -> client.ts
// -> router) and would make client.ts hard to unit-test in isolation. The
// router registers its real navigate function here once, at startup; until
// then (e.g. in a test that never calls registerNavigator) this is a silent
// no-op instead of throwing.
type Navigator = (path: string) => void;

let currentNavigate: Navigator | null = null;

export function registerNavigator(fn: Navigator): void {
  currentNavigate = fn;
}

export function navigateTo(path: string): void {
  currentNavigate?.(path);
}
