import { clerkMiddleware } from '@clerk/nextjs/server';

const publicApiPaths = new Set(['/api/events', '/api/waitlist', '/api/clerk-webhook']);

function isPublicApiPath(pathname: string) {
  return publicApiPaths.has(pathname) || pathname.startsWith('/api/payment-webhooks/');
}

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const isProtectedPage = pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/account' || pathname.startsWith('/account/');
  const isProtectedApi = pathname.startsWith('/api/') && !isPublicApiPath(pathname);
  if (isProtectedPage || isProtectedApi) await auth.protect();
}, {
  // Keep Clerk's edge check aligned with the API's `azp` allowlist. Without
  // this, requests from the production app can be rejected before the rewrite
  // forwards them to the backend.
  authorizedParties: [
    'https://www.zappa.in',
    'https://zappa.in',
    'http://localhost:3000',
  ],
});

export const config = {
  matcher: ['/dashboard(.*)', '/account(.*)', '/api(.*)'],
};
