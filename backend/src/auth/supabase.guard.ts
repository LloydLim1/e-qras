import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Decorator to declare required roles on a controller or route
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Decorator to mark a route as public
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class SupabaseGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(private reflector: Reflector) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Validate the JWT against Supabase
    let user: any = null;
    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data?.user) throw new UnauthorizedException('Invalid or expired session token');
      user = data.user;
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid or expired session token');
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role,
      publicUserId: user.user_metadata?.public_user_id,
    };

    // Check required roles from the @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No role restriction on this route
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException(
        `Role '${request.user.role}' is not authorized for this endpoint`,
      );
    }

    return true;
  }
}
