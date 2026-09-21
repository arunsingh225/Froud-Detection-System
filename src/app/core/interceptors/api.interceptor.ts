import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Check if request is login
  const isLoginUrl = req.url.toLowerCase().includes('/auth/login');

  // Attach withCredentials so the browser sends the HttpOnly auth cookie automatically.
  // No Authorization header is injected — the JWT lives exclusively in the cookie.
  const authReq = req.clone({
    withCredentials: true
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      let friendlyMessage = 'An unexpected error occurred. Please try again.';

      if (error.status === 0) {
        // Network connection error
        friendlyMessage = 'Unable to connect to backend server. Please verify ASP.NET Core API is running on port 5000.';
      } else if (error.status === 400) {
        if (error.error?.message) {
          friendlyMessage = error.error.message;
        } else if (error.error?.errors && typeof error.error.errors === 'object') {
          const firstErr = Object.values(error.error.errors).flat()[0];
          friendlyMessage = typeof firstErr === 'string' ? firstErr : 'Invalid request payload submitted.';
        } else {
          friendlyMessage = 'Invalid request payload submitted.';
        }
      } else if (error.status === 401) {
        if (!isLoginUrl) {
          friendlyMessage = 'Session expired or unauthorized. Please log in.';
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('fraudguard_auth');
            localStorage.removeItem('fraudguard_user');
          }
          if (router.url !== '/login' && !router.url.startsWith('/login')) {
            router.navigate(['/login']);
          }
        } else {
          friendlyMessage = error.error?.message || 'Invalid email or password.';
        }
      } else if (error.status === 403) {
        friendlyMessage = 'Access Denied: You do not possess the required permissions for this action.';
      } else if (error.status === 404) {
        friendlyMessage = error.error?.message || 'The requested resource was not found.';
      } else if (error.status === 422) {
        friendlyMessage = 'The request could not be processed due to validation errors.';
      } else if (error.status === 500) {
        friendlyMessage = 'Backend service is temporarily experiencing difficulties. Please try again.';
      } else if (error.status === 503) {
        friendlyMessage = 'Fraud detection engine is temporarily unavailable. The transaction was saved safely.';
      }

      console.error(`[API Error ${error.status}]`, friendlyMessage);

      // Return user-facing error message without exposing backend stack trace
      return throwError(() => new Error(friendlyMessage));
    })
  );
};
