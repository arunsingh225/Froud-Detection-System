import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('route guards', () => {
  let router: Router;
  const state = {} as RouterStateSnapshot;

  function setup(auth: { loggedIn: boolean; role?: string }): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => auth.loggedIn,
            userRole: () => auth.role ?? null,
            hasAnyRole: (roles: string[]) => roles.map(r => r.toUpperCase()).includes((auth.role ?? '').toUpperCase())
          }
        }
      ]
    });
    router = TestBed.inject(Router);
  }

  function route(roles?: string[]): ActivatedRouteSnapshot {
    return { data: roles ? { roles } : {}, routeConfig: { path: 'audit-logs' } } as unknown as ActivatedRouteSnapshot;
  }

  const run = (guard: typeof authGuard, r: ActivatedRouteSnapshot) =>
    TestBed.runInInjectionContext(() => guard(r, state));

  const url = (result: unknown) => router.serializeUrl(result as UrlTree);

  describe('authGuard', () => {
    it('lets a logged-in user through', () => {
      setup({ loggedIn: true });
      expect(run(authGuard, route())).toBeTrue();
    });

    it('redirects an anonymous user to /login', () => {
      setup({ loggedIn: false });
      expect(url(run(authGuard, route()))).toBe('/login');
    });
  });

  describe('roleGuard', () => {
    it('redirects an anonymous user to /login even when roles are required', () => {
      setup({ loggedIn: false });
      expect(url(run(roleGuard, route(['ADMIN'])))).toBe('/login');
    });

    it('allows any logged-in user when the route declares no roles', () => {
      setup({ loggedIn: true, role: 'VIEWER' });
      expect(run(roleGuard, route())).toBeTrue();
      expect(run(roleGuard, route([]))).toBeTrue();
    });

    it('allows a user holding one of the required roles (case-insensitive)', () => {
      setup({ loggedIn: true, role: 'compliance' });
      expect(run(roleGuard, route(['ADMIN', 'COMPLIANCE']))).toBeTrue();
    });

    it('sends a user without the required role to the dashboard with accessDenied', () => {
      spyOn(console, 'warn');
      setup({ loggedIn: true, role: 'INVESTIGATOR' });
      expect(url(run(roleGuard, route(['ADMIN', 'COMPLIANCE'])))).toBe('/dashboard?accessDenied=true');
    });
  });
});
