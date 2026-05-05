// filepath: proxy.ts
// Next.js 16: "middleware" is renamed to "proxy"
// See: https://nextjs.org/docs/messages/middleware-to-proxy
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

// ============================================================
// ROUTE PROTECTION CONFIGURATION
// ============================================================

// Routes that require a specific role to access
const roleRoutes: { prefix: string; roles: string[] }[] = [
  { prefix: '/superadmin', roles: ['SUPERADMIN'] },
  { prefix: '/admin',      roles: ['ADMIN'] },
  { prefix: '/user',       roles: ['USER'] },
  { prefix: '/api/superadmin', roles: ['SUPERADMIN'] },
  { prefix: '/api/admin',      roles: ['ADMIN'] },
  { prefix: '/api/user',       roles: ['USER'] },
];

// Auth API routes — always public (no token needed)
const AUTH_API_PREFIX = '/api/auth/';

// Public page routes — accessible without a session
const PUBLIC_PAGE_ROUTES = ['/login', '/unauthorized', '/'];

// Static assets & Next.js internals — always bypass
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/uploads/') || // PDF files served from public/uploads
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|woff2?|ttf|eot)$/.test(pathname)
  );
}

// ============================================================
// PROXY FUNCTION (formerly "middleware")
// ============================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow static assets & Next.js internals
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // 2. Always allow auth API routes (login, logout, me)
  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  // 3. Check if this is a public page route
  const isPublicPage = PUBLIC_PAGE_ROUTES.includes(pathname);

  // 4. Get and verify the session token
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // No token — allow public pages, redirect everything else to login
    if (isPublicPage) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifyToken(token);

  if (!session) {
    // Invalid/expired token — clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // 5. Authenticated user visiting login page → redirect to their dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(getDashboardPath(session.role), request.url));
  }

  // 6. Enforce role-based access control
  for (const { prefix, roles } of roleRoutes) {
    if (pathname.startsWith(prefix)) {
      if (!roles.includes(session.role)) {
        // API routes: return 403 JSON
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Forbidden: insufficient permissions', role: session.role },
            { status: 403 }
          );
        }
        // Page routes: redirect to /unauthorized with context
        const url = new URL('/unauthorized', request.url);
        url.searchParams.set('from', pathname);
        url.searchParams.set('required', roles[0]);
        return NextResponse.redirect(url);
      }
      // Role matches — allow through
      break;
    }
  }

  // 7. Create response and apply strict Cache-Control headers for Bfcache protection
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

// Returns the default dashboard for a given role
function getDashboardPath(role: string): string {
  switch (role) {
    case 'SUPERADMIN': return '/superadmin';
    case 'ADMIN':      return '/admin';
    case 'USER':       return '/user';
    default:           return '/login';
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
