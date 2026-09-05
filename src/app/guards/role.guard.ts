import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles = route.data['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (authService.hasAnyRole(allowedRoles)) {
    return true;
  }

  // User does not possess the required RBAC role: redirect to dashboard
  console.warn(`[RoleGuard] Access denied for route '${route.routeConfig?.path}'. Required roles: [${allowedRoles.join(', ')}]. User role: '${authService.userRole()}'.`);
  return router.createUrlTree(['/dashboard'], {
    queryParams: { accessDenied: 'true' }
  });
};
