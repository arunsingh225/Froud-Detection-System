import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthConfig, AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

/** The few parts of Google Identity Services this page uses (the library is loaded from Google at run time). */
interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}
interface GoogleWindow {
  google?: { accounts?: { id?: GoogleIdApi } };
}

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
const RESEND_SECONDS = 30;

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    template: `
    <div class="relative min-h-screen w-full flex items-center justify-center p-5 bg-[#EEEDEB] dark:bg-[#0A0A0A]">
      <button
        type="button"
        (click)="themeService.toggleTheme()"
        class="absolute top-5 right-5 w-10 h-10 rounded-full border border-[#E3E1DD] bg-[#FBFBFA] text-[#6B6A66] hover:text-[#1C1B19] dark:border-white/10 dark:bg-[#111111] dark:text-[#A3A3A3] dark:hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer"
        [title]="'Switch to ' + (themeService.isDark() ? 'light' : 'dark') + ' theme'"
        [attr.aria-label]="'Switch to ' + (themeService.isDark() ? 'light' : 'dark') + ' theme'"
        >
        <span class="material-symbols-outlined text-[20px]">{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</span>
      </button>

      <div class="w-full max-w-[520px] rounded-[28px] bg-[#FBFBFA] border border-[#F1F0ED] dark:bg-[#111111] dark:border-white/5 shadow-[0_24px_70px_-24px_rgba(28,27,25,0.18)] p-8 sm:p-12">
        <!-- Brand -->
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-[14px] bg-[#1C1B19] dark:bg-[#F5F5F4] flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px] text-[#FFFFFF] dark:text-[#1C1B19]">shield</span>
          </div>
          <span class="text-[20px] font-semibold tracking-tight text-[#1C1B19] dark:text-[#F5F5F4]">FraudGuard AI</span>
        </div>

        <h1 class="mt-10 text-[30px] leading-tight font-semibold tracking-tight text-[#1C1B19] dark:text-[#F5F5F4]">Welcome back</h1>
        <p class="mt-2 text-[15px] text-[#6B6A66] dark:text-[#A3A3A3]">Sign in to your account to continue</p>

        <!-- Method tabs: shown only when phone sign-in is switched on -->
        @if (config.phoneLoginEnabled) {
          <div class="mt-8 p-1 rounded-[14px] bg-[#F3F2EF] dark:bg-[#1A1A1A] grid grid-cols-2 gap-1" role="tablist">
            <button type="button" role="tab" [attr.aria-selected]="tab === 'email'" (click)="selectTab('email')"
              class="h-11 rounded-[11px] text-[14px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              [class]="tab === 'email' ? 'bg-[#FFFFFF] text-[#1C1B19] shadow-sm dark:bg-[#2A2A2A] dark:text-[#F5F5F4]' : 'text-[#6B6A66] hover:text-[#1C1B19] dark:text-[#A3A3A3] dark:hover:text-[#F5F5F4]'">
              <span class="material-symbols-outlined text-[18px]">mail</span> Email
            </button>
            <button type="button" role="tab" [attr.aria-selected]="tab === 'phone'" (click)="selectTab('phone')"
              class="h-11 rounded-[11px] text-[14px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              [class]="tab === 'phone' ? 'bg-[#FFFFFF] text-[#1C1B19] shadow-sm dark:bg-[#2A2A2A] dark:text-[#F5F5F4]' : 'text-[#6B6A66] hover:text-[#1C1B19] dark:text-[#A3A3A3] dark:hover:text-[#F5F5F4]'">
              <span class="material-symbols-outlined text-[18px]">smartphone</span> Phone
            </button>
          </div>
        }

        @if (errorMessage) {
          <div role="alert" class="mt-6 p-3.5 rounded-[14px] bg-[#e05353]/15 border border-[#e05353]/30 flex items-start gap-2.5 text-[#B42318] dark:text-[#ffb4ab] text-[13px]">
            <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
            <span>{{ errorMessage }}</span>
          </div>
        }
        @if (infoMessage) {
          <div role="status" class="mt-6 p-3.5 rounded-[14px] bg-[#16a34a]/10 border border-[#16a34a]/25 flex items-start gap-2.5 text-[#166534] dark:text-[#86efac] text-[13px]">
            <span class="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
            <span>{{ infoMessage }}</span>
          </div>
        }

        <!-- Email and password -->
        @if (tab === 'email') {
          <form (ngSubmit)="onSubmit()" class="mt-8 space-y-5">
            <div>
              <label for="login-email" class="block text-[14px] font-medium text-[#44423E] dark:text-[#D4D4D4] mb-2">Email</label>
              <input
                id="login-email"
                type="email"
                name="email"
                [(ngModel)]="email"
                required
                autofocus
                placeholder="you@company.com"
                autocomplete="username"
                class="w-full h-[52px] px-4 rounded-[14px] bg-[#FFFFFF] border border-[#E3E1DD] text-[#1C1B19] placeholder-[#9A9893] dark:bg-[#1A1A1A] dark:border-white/10 dark:text-[#F5F5F4] dark:placeholder-[#737373] text-[15px] outline-none focus:border-[#1C1B19] focus:ring-2 focus:ring-[#1C1B19]/10 dark:focus:border-[#F5F5F4] dark:focus:ring-[#F5F5F4]/15 transition-colors"
                />
            </div>

            <div>
              <label for="login-password" class="block text-[14px] font-medium text-[#44423E] dark:text-[#D4D4D4] mb-2">Password</label>
              <div class="relative">
                <input
                  id="login-password"
                  [type]="showPassword ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="password"
                  required
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  (keyup)="capsLock = $event.getModifierState('CapsLock')"
                  (blur)="capsLock = false"
                  class="w-full h-[52px] pl-4 pr-12 rounded-[14px] bg-[#FFFFFF] border border-[#E3E1DD] text-[#1C1B19] placeholder-[#9A9893] dark:bg-[#1A1A1A] dark:border-white/10 dark:text-[#F5F5F4] dark:placeholder-[#737373] text-[15px] outline-none focus:border-[#1C1B19] focus:ring-2 focus:ring-[#1C1B19]/10 dark:focus:border-[#F5F5F4] dark:focus:ring-[#F5F5F4]/15 transition-colors"
                  />
                <button
                  type="button"
                  (click)="showPassword = !showPassword"
                  class="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-[#8A8985] hover:text-[#1C1B19] dark:hover:text-[#FFFFFF] cursor-pointer"
                  [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                  >
                  <span class="material-symbols-outlined text-[20px]">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
              @if (capsLock) {
                <div class="mt-2 text-[12px] text-[#f59e0b] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[15px]">keyboard_capslock</span>
                  Caps Lock is on
                </div>
              }
            </div>

            <button
              type="submit"
              [disabled]="isLoading || !email || !password"
              class="w-full h-[54px] rounded-[14px] bg-[#1C1B19] hover:bg-[#2F2E2B] text-[#FFFFFF] dark:bg-[#F5F5F4] dark:hover:bg-[#E4E4E2] dark:text-[#1C1B19] disabled:opacity-50 disabled:cursor-not-allowed text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
              @if (isLoading) {
                <span class="w-4 h-4 border-2 border-[#FFFFFF]/40 border-t-[#FFFFFF] dark:border-[#1C1B19]/30 dark:border-t-[#1C1B19] rounded-full animate-spin"></span>
                <span>Signing in</span>
              } @else {
                <span>Sign in</span>
              }
            </button>
          </form>
        }

        <!-- Phone: number, then the code from the SMS -->
        @if (tab === 'phone') {
          <div class="mt-8">
            <label for="login-phone" class="block text-[14px] font-medium text-[#44423E] dark:text-[#D4D4D4] mb-2">Phone number</label>
            <div class="flex gap-3">
              <input
                id="login-phone"
                type="tel"
                name="phone"
                [(ngModel)]="phone"
                [disabled]="otpSent"
                (keydown.enter)="sendCode()"
                autocomplete="tel"
                [placeholder]="'e.g. ' + config.defaultCountryCode + ' 98765 43210'"
                class="flex-1 min-w-0 h-[52px] px-4 rounded-[14px] bg-[#FFFFFF] border border-[#E3E1DD] text-[#1C1B19] placeholder-[#9A9893] dark:bg-[#1A1A1A] dark:border-white/10 dark:text-[#F5F5F4] dark:placeholder-[#737373] disabled:opacity-60 text-[15px] outline-none focus:border-[#1C1B19] focus:ring-2 focus:ring-[#1C1B19]/10 dark:focus:border-[#F5F5F4] dark:focus:ring-[#F5F5F4]/15 transition-colors"
                />
              <button
                type="button"
                (click)="sendCode()"
                [disabled]="isLoading || !phone || (otpSent && cooldown > 0)"
                class="shrink-0 h-[52px] px-5 rounded-[14px] bg-[#1C1B19] hover:bg-[#2F2E2B] text-[#FFFFFF] dark:bg-[#F5F5F4] dark:hover:bg-[#E4E4E2] dark:text-[#1C1B19] disabled:opacity-50 disabled:cursor-not-allowed text-[15px] font-semibold cursor-pointer transition-colors"
                >
                {{ otpSent ? (cooldown > 0 ? 'Resend in ' + cooldown + 's' : 'Resend code') : 'Send code' }}
              </button>
            </div>

            @if (otpSent) {
              <form (ngSubmit)="verifyCode()" class="mt-5 space-y-5">
                <div>
                  <label for="login-otp" class="block text-[14px] font-medium text-[#44423E] dark:text-[#D4D4D4] mb-2">6-digit code</label>
                  <input
                    id="login-otp"
                    type="text"
                    name="otp"
                    inputmode="numeric"
                    maxlength="6"
                    autocomplete="one-time-code"
                    [(ngModel)]="otp"
                    (ngModelChange)="otp = onlyDigits($event)"
                    autofocus
                    placeholder="123456"
                    class="w-full h-[52px] px-4 rounded-[14px] bg-[#FFFFFF] border border-[#E3E1DD] text-[#1C1B19] placeholder-[#9A9893] dark:bg-[#1A1A1A] dark:border-white/10 dark:text-[#F5F5F4] dark:placeholder-[#737373] text-[20px] tracking-[0.4em] outline-none focus:border-[#1C1B19] focus:ring-2 focus:ring-[#1C1B19]/10 dark:focus:border-[#F5F5F4] dark:focus:ring-[#F5F5F4]/15 transition-colors"
                    />
                </div>
                <button
                  type="submit"
                  [disabled]="isLoading || otp.length !== 6"
                  class="w-full h-[54px] rounded-[14px] bg-[#1C1B19] hover:bg-[#2F2E2B] text-[#FFFFFF] dark:bg-[#F5F5F4] dark:hover:bg-[#E4E4E2] dark:text-[#1C1B19] disabled:opacity-50 disabled:cursor-not-allowed text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                  @if (isLoading) {
                    <span class="w-4 h-4 border-2 border-[#FFFFFF]/40 border-t-[#FFFFFF] dark:border-[#1C1B19]/30 dark:border-t-[#1C1B19] rounded-full animate-spin"></span>
                    <span>Verifying</span>
                  } @else {
                    <span>Verify and sign in</span>
                  }
                </button>
                <button type="button" (click)="changeNumber()" class="block mx-auto text-[13px] text-[#6B6A66] hover:text-[#1C1B19] dark:text-[#A3A3A3] dark:hover:text-[#F5F5F4] underline cursor-pointer">
                  Use a different number
                </button>
              </form>
            }
          </div>
        }

        <!-- Google (rendered by Google; shown only when a client id is configured) -->
        @if (config.googleClientId) {
          <div class="mt-7 flex items-center gap-4 text-[13px] text-[#8A8985] dark:text-[#737373]">
            <span class="flex-1 h-px bg-[#E3E1DD] dark:bg-white/10"></span>or<span class="flex-1 h-px bg-[#E3E1DD] dark:bg-white/10"></span>
          </div>
          <div class="mt-6 flex justify-center min-h-[44px]">
            <div id="google-signin-button"></div>
          </div>
        }

        <p class="mt-8 text-center text-[14px] text-[#6B6A66] dark:text-[#A3A3A3]">
          No account yet? <span class="font-semibold text-[#1C1B19] dark:text-[#F5F5F4]">Ask your administrator</span> to create one.
        </p>
        <p class="mt-2 text-center text-[12px] text-[#8A8985] dark:text-[#737373]">Demo environment with synthetic data</p>
      </div>
    </div>
    `
})
export class LoginComponent implements OnInit, OnDestroy {
  tab: 'email' | 'phone' = 'email';
  config: AuthConfig = { googleClientId: null, phoneLoginEnabled: false, defaultCountryCode: '+91' };

  email = '';
  password = '';
  showPassword = false;
  capsLock = false;

  phone = '';
  otp = '';
  otpSent = false;
  cooldown = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  isLoading = false;
  errorMessage: string | null = null;
  infoMessage: string | null = null;

  constructor(
    public themeService: ThemeService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.config = await this.authService.getAuthConfig();
    if (this.config.googleClientId) {
      setTimeout(() => this.loadGoogle(this.config.googleClientId!), 0);
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  selectTab(tab: 'email' | 'phone'): void {
    this.tab = tab;
    this.errorMessage = null;
    this.infoMessage = null;
  }

  onlyDigits(value: string): string {
    return (value ?? '').replace(/\D/g, '').slice(0, 6);
  }

  // ---------------------------------------------------------------- email + password
  async onSubmit(): Promise<void> {
    await this.run(async () => {
      if (await this.authService.login(this.email, this.password)) this.router.navigate(['/dashboard']);
    }, 'Invalid email or password.');
  }

  // ---------------------------------------------------------------- phone one-time code
  async sendCode(): Promise<void> {
    if (!this.phone || this.isLoading || (this.otpSent && this.cooldown > 0)) return;
    await this.run(async () => {
      await this.authService.requestOtp(this.phone);
      this.otpSent = true;
      this.otp = '';
      this.infoMessage = 'If this number is registered, a sign-in code has been sent.';
      this.startCooldown();
    }, 'Could not send a code. Please try again.');
  }

  async verifyCode(): Promise<void> {
    if (this.otp.length !== 6) return;
    await this.run(async () => {
      if (await this.authService.verifyOtp(this.phone, this.otp)) this.router.navigate(['/dashboard']);
    }, 'The code is wrong or has expired.');
  }

  changeNumber(): void {
    this.otpSent = false;
    this.otp = '';
    this.infoMessage = null;
    this.errorMessage = null;
    this.stopTimer();
    this.cooldown = 0;
  }

  // ---------------------------------------------------------------- Google
  private loadGoogle(clientId: string): void {
    const ready = () => this.renderGoogle(clientId);
    if ((window as unknown as GoogleWindow).google?.accounts?.id) {
      ready();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: GOOGLE_SCRIPT, async: true, defer: true });
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => {
      this.errorMessage = 'Google sign-in could not be loaded. Check your connection or use another method.';
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  }

  private renderGoogle(clientId: string): void {
    const api = (window as unknown as GoogleWindow).google?.accounts?.id;
    const host = document.getElementById('google-signin-button');
    if (!api || !host) return;
    api.initialize({
      client_id: clientId,
      callback: response => this.onGoogleCredential(response.credential)
    });
    api.renderButton(host, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 360 });
  }

  private async onGoogleCredential(credential: string): Promise<void> {
    await this.run(async () => {
      if (await this.authService.loginWithGoogle(credential)) this.router.navigate(['/dashboard']);
    }, 'This Google account cannot sign in.');
  }

  // ---------------------------------------------------------------- shared
  private async run(action: () => Promise<void>, fallbackMessage: string): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    if (this.tab !== 'phone' || !this.otpSent) this.infoMessage = null;
    try {
      await action();
    } catch (err: unknown) {
      this.infoMessage = null;
      this.errorMessage = (err instanceof Error && err.message) || fallbackMessage;
    } finally {
      this.isLoading = false;
    }
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown = RESEND_SECONDS;
    this.timer = setInterval(() => {
      this.cooldown = Math.max(0, this.cooldown - 1);
      if (this.cooldown === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
