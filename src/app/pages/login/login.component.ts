import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ShaderBackgroundComponent } from '../../shared/components/shader-background.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ShaderBackgroundComponent],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }

    /* =========================================================
       LIGHT MODE UI FOR FRAUDGUARD AI LOGIN PAGE
       Applies ONLY when html has class 'light'
       ========================================================= */

    /* 1. Main Authentication Card */
    :host-context(html.light) .login-card {
      background-color: rgba(255, 255, 255, 0.95) !important;
      border-color: rgba(0, 0, 0, 0.09) !important;
      box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.04) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
    }

    /* 2. Text Colors */
    :host-context(html.light) .login-heading {
      color: #121212 !important;
    }

    :host-context(html.light) .login-subtext {
      color: #52525B !important;
    }

    :host-context(html.light) .login-label {
      color: #3F3F46 !important;
      font-weight: 500 !important;
    }

    /* 3. Input Fields */
    :host-context(html.light) .login-input-container {
      background-color: #F7F6F2 !important;
      border-color: rgba(0, 0, 0, 0.12) !important;
    }

    :host-context(html.light) .login-input-container:focus-within {
      border-color: #9C782B !important;
      background-color: #FFFFFF !important;
      box-shadow: 0 0 0 3px rgba(156, 120, 43, 0.15) !important;
    }

    :host-context(html.light) .login-input {
      color: #121212 !important;
    }

    :host-context(html.light) .login-input::placeholder {
      color: #8E8E93 !important;
    }

    :host-context(html.light) .login-icon {
      color: #71717A !important;
    }

    :host-context(html.light) .login-toggle-pw {
      color: #71717A !important;
    }

    :host-context(html.light) .login-toggle-pw:hover {
      color: #121212 !important;
    }

    /* 4. Checkbox & Verification */
    :host-context(html.light) .login-checkbox-label {
      color: #3F3F46 !important;
    }

    :host-context(html.light) .login-checkbox {
      background-color: #FFFFFF !important;
      border-color: rgba(0, 0, 0, 0.25) !important;
    }

    :host-context(html.light) .login-verified-badge {
      color: #065F46 !important;
    }

    /* 5. Quick-Fill RBAC Buttons */
    :host-context(html.light) .login-profile-section {
      border-color: rgba(0, 0, 0, 0.08) !important;
    }

    :host-context(html.light) .login-profile-title {
      color: #52525B !important;
    }

    :host-context(html.light) .login-profile-btn {
      background-color: #F7F6F2 !important;
      border-color: rgba(0, 0, 0, 0.08) !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
    }

    :host-context(html.light) .login-profile-btn:hover {
      background-color: #EDEAE1 !important;
      border-color: rgba(156, 120, 43, 0.45) !important;
    }

    :host-context(html.light) .login-profile-name {
      color: #121212 !important;
    }

    :host-context(html.light) .login-profile-role {
      color: #826320 !important;
      font-weight: 600 !important;
    }

    /* 6. Error Banner */
    :host-context(html.light) .login-error-banner {
      background-color: rgba(220, 38, 38, 0.08) !important;
      border-color: rgba(220, 38, 38, 0.25) !important;
      color: #991B1B !important;
    }

    /* 7. Top-Right Floating Theme Toggle */
    :host-context(html.light) .login-theme-toggle {
      background-color: rgba(255, 255, 255, 0.92) !important;
      border-color: rgba(0, 0, 0, 0.1) !important;
      color: #826320 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
    }

    :host-context(html.light) .login-theme-toggle:hover {
      border-color: #9C782B !important;
      color: #694F16 !important;
    }

    /* 8. Left-Side Branding & Badges */
    :host-context(html.light) .login-brand-title {
      color: #121212 !important;
    }

    :host-context(html.light) .login-brand-badge {
      color: #826320 !important;
    }

    :host-context(html.light) .login-status-pill {
      background-color: rgba(255, 255, 255, 0.92) !important;
      border-color: rgba(156, 120, 43, 0.3) !important;
      color: #826320 !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
    }

    :host-context(html.light) .login-left-heading {
      color: #121212 !important;
    }

    :host-context(html.light) .login-left-subtext {
      color: #52525B !important;
    }

    :host-context(html.light) .login-feature-pill {
      background-color: rgba(255, 255, 255, 0.92) !important;
      border-color: rgba(0, 0, 0, 0.08) !important;
      color: #27272A !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03) !important;
    }

    :host-context(html.light) .login-left-footer {
      color: #71717A !important;
    }
  `],
  template: `
    <div class="relative w-full h-full min-h-screen bg-[#0A0A0A] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden select-none">
      <!-- Interactive WebGL Neural Shader Background -->
      <div class="absolute inset-0 z-0">
        <app-shader-background></app-shader-background>
      </div>

      <!-- Top Floating Theme Toggle -->
      <div class="absolute top-6 right-6 z-20">
        <button
          (click)="themeService.toggleTheme()"
          class="login-theme-toggle p-2.5 rounded-full bg-[#0D0D0D]/80 backdrop-blur border border-white/10 text-[#C5A059] hover:border-[#C5A059] shadow-lg transition-all flex items-center gap-2 text-[12px] cursor-pointer"
          [title]="'Switch to ' + (themeService.isDark() ? 'Light' : 'Dark') + ' Mode'"
        >
          <span class="material-symbols-outlined text-[18px]">
            {{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}
          </span>
          <span class="hidden sm:inline font-mono-data uppercase text-[10px]">
            {{ themeService.isDark() ? 'Light Mode' : 'Dark Mode' }}
          </span>
        </button>
      </div>

      <!-- Left Branding Overlay -->
      <div class="relative z-10 flex-1 flex flex-col justify-between p-8 lg:p-16 text-white max-w-2xl pointer-events-none lg:pointer-events-auto">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#141414] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.2)]">
            <span class="material-symbols-outlined text-[24px] fill-1">shield</span>
          </div>
          <div>
            <h1 class="login-brand-title font-serif italic text-2xl tracking-tight text-white">FraudGuard AI</h1>
            <span class="login-brand-badge text-[10px] font-mono-data text-[#C5A059] uppercase tracking-widest block">
              Enterprise Security & Intelligence
            </span>
          </div>
        </div>

        <div class="my-auto py-12 space-y-4">
          <div class="login-status-pill inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414] border border-[#C5A059]/30 text-[#C5A059] text-[11px] font-mono-data tracking-wider uppercase">
            <span class="w-2 h-2 rounded-full bg-[#52b788] pulse-dot"></span>
            Real-Time Neural Inference Active
          </div>

          <h2 class="login-left-heading font-serif italic text-3xl lg:text-5xl tracking-tight text-white leading-tight">
            Autonomous threat detection for enterprise scale.
          </h2>

          <p class="login-left-subtext text-[#A3A3A3] text-[15px] max-w-lg leading-relaxed font-sans">
            Protect multi-million dollar transaction volumes with sub-50ms behavioral scoring, impossible travel verification, and automated FinCEN compliance workflows.
          </p>

          <div class="flex flex-wrap gap-3 pt-4 text-[11px] font-mono-data text-[#D4D4D4]">
            <div class="login-feature-pill flex items-center gap-1.5 bg-[#0D0D0D]/90 border border-white/5 px-3 py-1.5 rounded-lg">
              <span class="material-symbols-outlined text-[16px] text-[#52b788]">verified</span>
              <span>SOC2 Type II</span>
            </div>
            <div class="login-feature-pill flex items-center gap-1.5 bg-[#0D0D0D]/90 border border-white/5 px-3 py-1.5 rounded-lg">
              <span class="material-symbols-outlined text-[16px] text-[#C5A059]">lock</span>
              <span>Zero-Trust FIDO2</span>
            </div>
            <div class="login-feature-pill flex items-center gap-1.5 bg-[#0D0D0D]/90 border border-white/5 px-3 py-1.5 rounded-lg">
              <span class="material-symbols-outlined text-[16px] text-[#C5A059]">memory</span>
              <span>18ms TPU Latency</span>
            </div>
          </div>
        </div>

        <div class="login-left-footer text-[11px] text-[#737373] font-mono-data">
          FraudGuard Core v4.8 • Build 2026.08.30
        </div>
      </div>

      <!-- Right Login Card -->
      <div class="relative z-10 flex items-center justify-center p-6 lg:p-12 w-full lg:w-[480px] shrink-0">
        <div class="login-card w-full bg-[#0D0D0D]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 lg:p-8 space-y-6 shadow-2xl">
          <div>
            <h3 class="login-heading font-serif italic text-2xl text-white tracking-tight">Console Authentication</h3>
            <p class="login-subtext text-[13px] text-[#A3A3A3] mt-1">
              Sign in with your Tier 3 security credentials to access the investigative workspace.
            </p>
          </div>

          <!-- Error Banner -->
          <div *ngIf="errorMessage" class="login-error-banner p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-red-200 text-[12px]">
            <span class="material-symbols-outlined text-[18px] text-red-400 shrink-0">error</span>
            <span>{{ errorMessage }}</span>
          </div>

          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="login-label text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1.5">
                Corporate Email / SSO Handle
              </label>
              <div class="login-input-container flex items-center bg-[#141414] rounded-xl px-3.5 py-2.5 border border-white/10 focus-within:border-[#C5A059] transition-all">
                <span class="login-icon material-symbols-outlined text-[18px] text-[#737373] mr-2">mail</span>
                <input
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  required
                  placeholder="name@fraudguard.enterprise.io"
                  class="login-input w-full bg-transparent text-white text-[13px] focus:outline-none placeholder-[#525252]"
                />
              </div>
            </div>

            <div>
              <label class="login-label text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1.5">
                Hardware Key Passcode / Password
              </label>
              <div class="login-input-container flex items-center bg-[#141414] rounded-xl px-3.5 py-2.5 border border-white/10 focus-within:border-[#C5A059] transition-all">
                <span class="login-icon material-symbols-outlined text-[18px] text-[#737373] mr-2">key</span>
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  name="password"
                  [(ngModel)]="password"
                  required
                  placeholder="••••••••••••"
                  class="login-input w-full bg-transparent text-white text-[13px] focus:outline-none placeholder-[#525252]"
                />
                <button
                  type="button"
                  (click)="showPassword = !showPassword"
                  class="login-toggle-pw text-[#737373] hover:text-white transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[18px]">
                    {{ showPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between text-[12px]">
              <label class="login-checkbox-label flex items-center gap-2 cursor-pointer text-[#A3A3A3]">
                <input
                  type="checkbox"
                  name="rememberDevice"
                  [(ngModel)]="rememberDevice"
                  class="login-checkbox rounded border-white/10 text-[#C5A059] accent-[#C5A059] focus:ring-0 bg-[#141414]"
                />
                <span>Remember FIDO2 token</span>
              </label>
              <span class="login-verified-badge text-[11px] text-[#52b788] font-mono-data">Device Verified</span>
            </div>

            <button
              type="submit"
              [disabled]="isLoading"
              class="w-full py-3 rounded-xl bg-[#C5A059] hover:bg-[#dfba73] disabled:opacity-50 text-[#0A0A0A] font-bold uppercase tracking-[0.15em] text-[12px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)] active:scale-95 cursor-pointer"
            >
              <ng-container *ngIf="isLoading; else defaultBtn">
                <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                <span>Verifying Credentials...</span>
              </ng-container>
              <ng-template #defaultBtn>
                <span class="material-symbols-outlined text-[20px]">login</span>
                <span>Enter Security Console</span>
              </ng-template>
            </button>
          </form>

          <!-- Quick Fill Test Accounts -->
          <div class="login-profile-section pt-2 border-t border-white/5 space-y-2">
            <span class="login-profile-title text-[10px] font-mono-data text-[#737373] uppercase tracking-widest block">
              Quick-Fill Role Profiles (RBAC)
            </span>
            <div class="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                (click)="handleQuickFill('riya.desai@fraudguard.enterprise.io')"
                class="login-profile-btn p-2 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#C5A059]/40 text-[#C5A059] text-center transition-colors truncate cursor-pointer"
              >
                <b class="login-profile-name block truncate">Riya Desai</b>
                <span class="login-profile-role text-[9px] text-[#A3A3A3]">INVESTIGATOR</span>
              </button>
              <button
                type="button"
                (click)="handleQuickFill('priyanka.iyer@fraudguard.enterprise.io')"
                class="login-profile-btn p-2 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#C5A059]/40 text-[#C5A059] text-center transition-colors truncate cursor-pointer"
              >
                <b class="login-profile-name block truncate">Priyanka Iyer</b>
                <span class="login-profile-role text-[9px] text-[#A3A3A3]">ADMIN</span>
              </button>
              <button
                type="button"
                (click)="handleQuickFill('amit.bose@fraudguard.enterprise.io')"
                class="login-profile-btn p-2 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 hover:border-[#C5A059]/40 text-[#C5A059] text-center transition-colors truncate cursor-pointer"
              >
                <b class="login-profile-name block truncate">Amit Bose</b>
                <span class="login-profile-role text-[9px] text-[#A3A3A3]">COMPLIANCE</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  email = 'riya.desai@fraudguard.enterprise.io';
  password = 'password123';
  showPassword = false;
  rememberDevice = true;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    public themeService: ThemeService,
    private authService: AuthService,
    private router: Router
  ) {}

  handleQuickFill(email: string): void {
    this.email = email;
    this.password = 'password123';
    this.errorMessage = null;
  }

  async onSubmit(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const success = await this.authService.login(this.email, this.password);
      if (success) {
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Invalid email or password.';
    } finally {
      this.isLoading = false;
    }
  }
}
