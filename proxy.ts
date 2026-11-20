import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { clerkConfigured } from './lib/clerk-config';

const publicApiPaths = new Set(['/api/events', '/api/waitlist', '/api/clerk-webhook']);

function isPublicApiPath(pathname: string) {
  return publicApiPaths.has(pathname) || pathname.startsWith('/api/payment-webhooks/');
}

function isProtectedPage(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/account' || pathname.startsWith('/account/');
}

function isProtectedApi(pathname: string) {
  return pathname.startsWith('/api/') && !isPublicApiPath(pathname);
}

const clerkProxy = clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      const pathname = request.nextUrl.pathname;
      if (isProtectedPage(pathname) || isProtectedApi(pathname)) await auth.protect();
    }, {
      // Keep Clerk's edge check aligned with the API's `azp` allowlist. Without
      // this, requests from the production app can be rejected before the rewrite
      // forwards them to the backend.
      authorizedParties: [
        'https://www.zappa.in',
        'https://zappa.in',
        'http://localhost:3000',
      ],
    })
  : null;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (clerkProxy) return clerkProxy(request, event);

  const pathname = request.nextUrl.pathname;
  if (isProtectedApi(pathname)) {
    return NextResponse.json({ error: 'Authentication is not configured for this environment.' }, { status: 503 });
  }
  if (isProtectedPage(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/sign-in';
    signInUrl.search = '';
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard(.*)', '/account(.*)', '/api(.*)'],
};
