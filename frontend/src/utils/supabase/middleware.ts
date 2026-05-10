import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // getUser(). A simple mistake can make it very hard to debug
  // issues with users being logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    !request.nextUrl.pathname.startsWith('/reset-password') &&
    !request.nextUrl.pathname.startsWith('/verify-otp') &&
    request.nextUrl.pathname !== '/'
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ─── Role-Based Access Control ──────────────────────────────────────────
  // Path → set of roles allowed to access it. Roles read from the JWT
  // (user_metadata.role), NOT localStorage, since localStorage is trivially
  // editable client-side.
  if (user) {
    const userRole = ((user.user_metadata as Record<string, unknown> | undefined)?.role as string | undefined) ?? '';
    const path = request.nextUrl.pathname;

    const ROLE_RULES: Array<{ prefix: string; allow: ReadonlyArray<string> }> = [
      { prefix: '/user-management', allow: ['admin'] },
      { prefix: '/import',          allow: ['admin'] },
      { prefix: '/add-person',      allow: ['admin', 'teacher'] },
      { prefix: '/student-qrs',     allow: ['admin', 'teacher'] },
      { prefix: '/my-section',      allow: ['admin', 'teacher'] },
      { prefix: '/reports',         allow: ['admin', 'teacher'] },
      { prefix: '/attendance',      allow: ['admin', 'teacher'] },
      { prefix: '/qr-scanner',      allow: ['admin', 'guard'] },
      // /dashboard and /settings are open to every authenticated role.
    ];

    const rule = ROLE_RULES.find(r => path === r.prefix || path.startsWith(r.prefix + '/'));
    if (rule && !rule.allow.includes(userRole)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but make sure it accepts a `NextResponse`
  //    return myNewResponse
  // If not, you can get stuck in a redirect loop.
  return supabaseResponse
}
