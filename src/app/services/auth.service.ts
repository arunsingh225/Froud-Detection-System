import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { UserRole } from '../models/types.model';

export interface UserProfile {
  userId: string;
  userCode: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  department?: string;
}

interface LoginResponseData {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: {
    userId: string;
    userCode: string;
    fullName: string;
    email: string;
    role: string;
    department?: string;
  };
}

interface UserProfileData {
  userId: string;
  userCode: string;
  fullName: string;
  email: string;
  role: string;
  initials: string;
  department?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Only user profile display data is stored in localStorage (non-sensitive)
  private readonly AUTH_KEY = 'fraudguard_auth';
  private readonly USER_KEY = 'fraudguard_user';

  // Signals
  isLoggedIn = signal<boolean>(this.checkInitialAuth());
  currentUser = signal<UserProfile | null>(this.loadInitialUser());
  userRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  constructor() {
    // If we believe we're authenticated (from stored profile), verify against server
    if (this.isLoggedIn()) {
      this.verifyAndRefreshProfile();
    }
  }

  hasRole(role: string): boolean {
    const current = this.currentUser();
    if (!current) return false;
    return current.role.toUpperCase() === role.toUpperCase();
  }

  hasAnyRole(roles: string[]): boolean {
    const current = this.currentUser();
    if (!current) return false;
    const currentRole = current.role.toUpperCase();
    return roles.some(r => r.toUpperCase() === currentRole);
  }

  async login(email: string, password: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<LoginResponseData>>(`${environment.apiUrl}/auth/login`, {
        email,
        password
      }, { withCredentials: true })
    );

    if (res && res.success && res.data) {
      const u = res.data.user;
      const initials = u.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'FG';

      const profile: UserProfile = {
        userId: u.userId,
        userCode: u.userCode,
        name: u.fullName,
        email: u.email,
        role: u.role.toUpperCase() as UserRole,
        initials,
        department: u.department
      };

      // Store only non-sensitive display data — JWT is in HttpOnly cookie
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.AUTH_KEY, 'true');
        localStorage.setItem(this.USER_KEY, JSON.stringify(profile));
      }

      this.currentUser.set(profile);
      this.isLoggedIn.set(true);
      return true;
    }

    throw new Error(res.message || 'Authentication failed.');
  }

  async verifyAndRefreshProfile(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<UserProfileData>>(`${environment.apiUrl}/auth/me`, {
          withCredentials: true
        }).pipe(
          catchError(() => of(null))
        )
      );

      if (res && res.success && res.data) {
        const u = res.data;
        const profile: UserProfile = {
          userId: u.userId,
          userCode: u.userCode,
          name: u.fullName,
          email: u.email,
          role: u.role.toUpperCase() as UserRole,
          initials: u.initials || 'FG',
          department: u.department
        };

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.AUTH_KEY, 'true');
          localStorage.setItem(this.USER_KEY, JSON.stringify(profile));
        }

        this.currentUser.set(profile);
        this.isLoggedIn.set(true);
      } else {
        // Cookie is invalid or expired — server rejected
        this.logout();
      }
    } catch {
      this.logout();
    }
  }

  async logout(): Promise<void> {
    // Call server to clear cookie and revoke token
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/logout`, {}, {
          withCredentials: true
        }).pipe(catchError(() => of(null)))
      );
    } catch {
      // Best-effort — if server is unreachable, still clear local state
    }

    this.isLoggedIn.set(false);
    this.currentUser.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.AUTH_KEY);
      localStorage.removeItem(this.USER_KEY);
    }

    if (this.router.url !== '/login' && !this.router.url.startsWith('/login')) {
      this.router.navigate(['/login']);
    }
  }

  private checkInitialAuth(): boolean {
    if (typeof localStorage === 'undefined') return false;
    // We check if auth flag exists — actual authentication is verified by the HttpOnly cookie
    // which is sent automatically by the browser. The AUTH_KEY is just a UI state hint.
    return localStorage.getItem(this.AUTH_KEY) === 'true';
  }

  private loadInitialUser(): UserProfile | null {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(this.USER_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return null;
  }
}
