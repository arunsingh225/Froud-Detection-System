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

/** What the sign-in page may offer (public information from GET /auth/config). */
export interface AuthConfig {
  googleClientId: string | null;
  phoneLoginEnabled: boolean;
  defaultCountryCode: string;
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
      this.completeSignIn(res.data);
      return true;
    }

    throw new Error(res.message || 'Authentication failed.');
  }

  /** Asks for a one-time code by SMS. The API answers the same way whether or not the number is registered. */
  async requestOtp(phone: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse<object>>(`${environment.apiUrl}/auth/otp/request`, { phone }, { withCredentials: true })
    );
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<LoginResponseData>>(`${environment.apiUrl}/auth/otp/verify`, { phone, code }, { withCredentials: true })
    );
    if (res && res.success && res.data) {
      this.completeSignIn(res.data);
      return true;
    }
    throw new Error(res?.message || 'The code is wrong or has expired.');
  }

  /** Signs in with the Google ID token ("credential") from Google Identity Services. */
  async loginWithGoogle(credential: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<LoginResponseData>>(`${environment.apiUrl}/auth/google`, { credential }, { withCredentials: true })
    );
    if (res && res.success && res.data) {
      this.completeSignIn(res.data);
      return true;
    }
    throw new Error(res?.message || 'This Google account cannot sign in.');
  }

  /** Which sign-in methods the server offers; on any error only e-mail and password are offered. */
  async getAuthConfig(): Promise<AuthConfig> {
    const fallback: AuthConfig = { googleClientId: null, phoneLoginEnabled: false, defaultCountryCode: '+91' };
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<AuthConfig>>(`${environment.apiUrl}/auth/config`));
      return res?.success && res.data ? { ...fallback, ...res.data } : fallback;
    } catch {
      return fallback;
    }
  }

  private completeSignIn(data: LoginResponseData): void {
    const u = data.user;
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

    this.clearLocalSession();
    if (this.router.url !== '/login' && !this.router.url.startsWith('/login')) {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Changes the signed-in user's own password. The server then signs this user out everywhere (this session included),
   * so the local state is cleared as well. Resolves to the message to show; rejects with the reason when refused.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<object>>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword }, { withCredentials: true })
    );
    if (!res || !res.success) throw new Error(res?.message || 'Could not change the password.');
    this.clearLocalSession();
    return res.message;
  }

  private clearLocalSession(): void {
    this.isLoggedIn.set(false);
    this.currentUser.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.AUTH_KEY);
      localStorage.removeItem(this.USER_KEY);
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
