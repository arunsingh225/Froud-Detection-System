import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService: sign-in without a password', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  const session = {
    success: true, message: 'ok', timestamp: 't',
    data: {
      token: '', tokenType: 'HttpOnly-Cookie', expiresAt: '2030-01-01T00:00:00Z',
      user: { userId: 'u1', userCode: 'USR-ADM-001', fullName: 'Test Admin', email: 'admin@example.com', role: 'admin' }
    }
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('asks the server for a code with the phone number and nothing else', async () => {
    const done = auth.requestOtp('98765 43210');
    const req = httpMock.expectOne(r => r.url.endsWith('/auth/otp/request'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phone: '98765 43210' });
    req.flush({ success: true, message: 'sent', timestamp: 't', data: {} });
    await done;
  });

  it('signs in with a correct code: stores only display data and marks the user logged in', async () => {
    const done = auth.verifyOtp('+919876543210', '123456');
    const req = httpMock.expectOne(r => r.url.endsWith('/auth/otp/verify'));
    expect(req.request.body).toEqual({ phone: '+919876543210', code: '123456' });
    req.flush(session);

    expect(await done).toBeTrue();
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.currentUser()?.role).toBe('ADMIN');
    expect(auth.currentUser()?.initials).toBe('TA');
    expect(localStorage.getItem('fraudguard_user')).not.toContain('token');
  });

  it('signs in with a Google credential through the API (the token itself is never stored)', async () => {
    const done = auth.loginWithGoogle('google-id-token');
    const req = httpMock.expectOne(r => r.url.endsWith('/auth/google'));
    expect(req.request.body).toEqual({ credential: 'google-id-token' });
    req.flush(session);

    expect(await done).toBeTrue();
    expect(auth.hasRole('admin')).toBeTrue();
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('google-id-token');
  });

  it('turns an unsuccessful answer into an error instead of a login', async () => {
    const done = auth.verifyOtp('+919876543210', '000000');
    httpMock.expectOne(r => r.url.endsWith('/auth/otp/verify')).flush({ success: false, message: 'wrong code', timestamp: 't', data: null });
    await expectAsync(done).toBeRejectedWithError('wrong code');
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('offers only e-mail and password when the configuration cannot be loaded', async () => {
    const done = auth.getAuthConfig();
    httpMock.expectOne(r => r.url.endsWith('/auth/config')).flush(null, { status: 500, statusText: 'err' });
    expect(await done).toEqual({ googleClientId: null, phoneLoginEnabled: false, defaultCountryCode: '+91' });
  });

  it('returns what the server offers', async () => {
    const done = auth.getAuthConfig();
    httpMock.expectOne(r => r.url.endsWith('/auth/config')).flush({
      success: true, message: 'ok', timestamp: 't', data: { googleClientId: 'cid', phoneLoginEnabled: true, defaultCountryCode: '+91' }
    });
    expect(await done).toEqual({ googleClientId: 'cid', phoneLoginEnabled: true, defaultCountryCode: '+91' });
  });

  it('changes the password and clears the local session, because the server signs the user out everywhere', async () => {
    const signIn = auth.verifyOtp('+919876543210', '123456');
    httpMock.expectOne(r => r.url.endsWith('/auth/otp/verify')).flush(session);
    await signIn;
    expect(auth.isLoggedIn()).toBeTrue();

    const done = auth.changePassword('OldPassw0rd', 'NewPassw0rd');
    const req = httpMock.expectOne(r => r.url.endsWith('/auth/change-password'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd' });
    req.flush({ success: true, message: 'Password changed.', timestamp: 't', data: {} });

    expect(await done).toBe('Password changed.');
    expect(auth.isLoggedIn()).toBeFalse();
    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('fraudguard_user')).toBeNull();
  });

  it('keeps the user signed in when the password change is refused', async () => {
    const signIn = auth.verifyOtp('+919876543210', '123456');
    httpMock.expectOne(r => r.url.endsWith('/auth/otp/verify')).flush(session);
    await signIn;

    const done = auth.changePassword('wrong', 'NewPassw0rd');
    httpMock.expectOne(r => r.url.endsWith('/auth/change-password'))
      .flush({ success: false, message: 'The current password is not correct.', timestamp: 't', data: null });

    await expectAsync(done).toBeRejectedWithError('The current password is not correct.');
    expect(auth.isLoggedIn()).toBeTrue();
  });
});
