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

  private readonly AUTH_KEY = 'fraudguard_auth';
  private readonly TOKEN_KEY = 'fraudguard_token';
  private readonly USER_KEY = 'fraudguard_user';

  // Signals
  isLoggedIn = signal<boolean>(this.checkInitialAuth());
  currentUser = signal<UserProfile | null>(this.loadInitialUser());
  userRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);

  constructor() {
    // If token exists, verify validity against server claims
    if (this.getToken()) {
      this.verifyAndRefreshProfile();
    }
  }

  getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY);
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
      })
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

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.TOKEN_KEY, res.data.token);
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
        this.http.get<ApiResponse<UserProfileData>>(`${environment.apiUrl}/auth/me`).pipe(
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
        // Token invalid or expired
        this.logout();
      }
    } catch {
      this.logout();
    }
  }

  logout(): void {
    this.isLoggedIn.set(false);
    this.currentUser.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.AUTH_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }

    if (this.router.url !== '/login' && !this.router.url.startsWith('/login')) {
      this.router.navigate(['/login']);
    }
  }

  private checkInitialAuth(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const token = localStorage.getItem(this.TOKEN_KEY);
    return !!token && token.length > 10;
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
