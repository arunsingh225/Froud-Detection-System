import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([apiInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(console, 'error');
    spyOn(router, 'navigate').and.resolveTo(true);
    localStorage.setItem('fraudguard_auth', 'true');
    localStorage.setItem('fraudguard_user', '{"name":"x"}');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  /** Issue a request that the backend answers with the given error; resolve to the user-facing message. */
  function failWith(url: string, status: number, body: object | null = null): Promise<string> {
    const result = new Promise<string>(resolve =>
      http.get(url).subscribe({ next: () => resolve('no error'), error: (e: Error) => resolve(e.message) }));
    httpMock.expectOne(url).flush(body, { status, statusText: 'err' });
    return result;
  }

  it('sends credentials and the anti-CSRF header, and never injects an Authorization header', () => {
    http.post('/api/transactions', {}).subscribe();
    const req = httpMock.expectOne('/api/transactions');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('on 401 for a normal call: clears stored session hints and redirects to /login', async () => {
    const msg = await failWith('/api/customers', 401);
    expect(msg).toContain('Session expired');
    expect(localStorage.getItem('fraudguard_auth')).toBeNull();
    expect(localStorage.getItem('fraudguard_user')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('on 401 for the login call: keeps state, surfaces the server message, no redirect', async () => {
    const msg = await failWith('/api/auth/login', 401, { message: 'Invalid credentials or account inactive.' });
    expect(msg).toBe('Invalid credentials or account inactive.');
    expect(localStorage.getItem('fraudguard_auth')).toBe('true');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('maps status codes to friendly messages without leaking backend details', async () => {
    expect(await failWith('/api/a', 403)).toContain('Access Denied');
    expect(await failWith('/api/b', 500, { stackTrace: 'at Secret.Method() in C:\\src\\Secret.cs' })).not.toContain('Secret');
    expect(await failWith('/api/c', 503)).toContain('temporarily unavailable');
    expect(await failWith('/api/d', 404, { message: 'Transaction not found.' })).toBe('Transaction not found.');
    expect(await failWith('/api/e', 400, { errors: { Amount: ['Amount must be positive.'] } })).toBe('Amount must be positive.');
  });

  it('reports a connection failure for status 0', async () => {
    const result = new Promise<string>(resolve =>
      http.get('/api/f').subscribe({ error: (e: Error) => resolve(e.message) }));
    httpMock.expectOne('/api/f').error(new ProgressEvent('error'));
    expect(await result).toContain('Unable to connect');
  });

  it('treats a 401 from the one-time-code and Google endpoints as wrong credentials, not an expired session', async () => {
    for (const url of ['/api/auth/otp/verify', '/api/auth/google']) {
      expect(await failWith(url, 401, { message: 'The code is wrong or has expired.' })).toBe('The code is wrong or has expired.');
    }
    expect(router.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('fraudguard_auth')).toBe('true');
  });

  it('explains rate limiting, and a sign-in method that is switched off', async () => {
    expect(await failWith('/api/auth/otp/request', 429)).toContain('Too many attempts');
    expect(await failWith('/api/auth/otp/request', 503, { message: 'Phone sign-in is not available.' })).toBe('Phone sign-in is not available.');
  });
});
