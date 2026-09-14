import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimit(ip: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             'unknown';

  // Rate limit auth endpoints: 10 requests per minute
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/signup')) {
    if (!getRateLimit(`auth:${ip}`, 60_000, 10)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  }

  // Rate limit general API: 60 requests per minute
  if (pathname.startsWith('/api/')) {
    if (!getRateLimit(`api:${ip}`, 60_000, 60)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  }

  // Rate limit agent execution: 5 requests per minute
  if (pathname.startsWith('/api/agent-api/execute')) {
    if (!getRateLimit(`execute:${ip}`, 60_000, 5)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  }

  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
