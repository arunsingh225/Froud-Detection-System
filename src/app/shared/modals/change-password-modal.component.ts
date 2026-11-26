import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** The same rules the server enforces (PasswordPolicy), so most mistakes are caught before the request is sent. */
export function passwordProblem(next: string, current: string): string | null {
  if (next.length < 8) return 'Use at least 8 characters.';
  if (next.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return 'Include at least one letter and one number.';
  if (next !== next.trim()) return 'Do not start or end with a space.';
  if (current && next === current) return 'The new password must be different from the current one.';
  return null;
}

@Component({
  selector: 'app-change-password-modal',
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" (click)="close()" data-testid="change-password-dialog">
      <div class="w-full max-w-md rounded-xl bg-[#0D0D0D] border border-white/10 p-6 shadow-xl" (click)="$event.stopPropagation()"
           role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <h3 id="cp-title" class="text-lg font-semibold text-white">Change password</h3>
        <p class="mt-1 text-[13px] text-[#A3A3A3]">You will be signed out everywhere and asked to sign in again with the new password.</p>

        @if (done) {
          <div class="mt-5 p-3.5 rounded-lg bg-[#52b788]/10 border border-[#52b788]/25 text-[13px] text-[#52b788]" role="status" data-testid="change-password-done">
            {{ done }}
          </div>
        } @else {
          <form (ngSubmit)="submit()" class="mt-5 space-y-4">
            <div>
              <label for="cp-current" class="block text-[13px] font-medium text-[#D4D4D4] mb-1.5">Current password</label>
              <input id="cp-current" name="current" [type]="show ? 'text' : 'password'" [(ngModel)]="current" autocomplete="current-password" required
                class="w-full h-11 px-3 rounded-lg bg-[#141414] border border-white/10 text-[14px] text-white outline-none focus:border-[#4A6FA5]" />
            </div>
            <div>
              <label for="cp-new" class="block text-[13px] font-medium text-[#D4D4D4] mb-1.5">New password</label>
              <input id="cp-new" name="next" [type]="show ? 'text' : 'password'" [(ngModel)]="next" autocomplete="new-password" required
                class="w-full h-11 px-3 rounded-lg bg-[#141414] border border-white/10 text-[14px] text-white outline-none focus:border-[#4A6FA5]" />
              <div class="mt-1 text-[12px]" [class]="next && problem ? 'text-[#e05353]' : 'text-[#737373]'" data-testid="change-password-hint">
                {{ next && problem ? problem : 'At least 8 characters, with a letter and a number.' }}
              </div>
            </div>
            <div>
              <label for="cp-confirm" class="block text-[13px] font-medium text-[#D4D4D4] mb-1.5">Repeat new password</label>
              <input id="cp-confirm" name="confirm" [type]="show ? 'text' : 'password'" [(ngModel)]="confirm" autocomplete="new-password" required
                class="w-full h-11 px-3 rounded-lg bg-[#141414] border border-white/10 text-[14px] text-white outline-none focus:border-[#4A6FA5]" />
              @if (confirm && confirm !== next) {
                <div class="mt-1 text-[12px] text-[#e05353]" data-testid="change-password-mismatch">The two passwords do not match.</div>
              }
            </div>
            <label class="flex items-center gap-2 text-[13px] text-[#A3A3A3] cursor-pointer">
              <input type="checkbox" name="show" [(ngModel)]="show" class="accent-[#4A6FA5]" /> Show passwords
            </label>

            @if (error) {
              <div class="text-[13px] text-[#e05353]" role="alert" data-testid="change-password-error">{{ error }}</div>
            }

            <div class="flex justify-end gap-3 pt-1">
              <button type="button" (click)="close()" class="px-4 py-2 rounded-lg border border-white/10 text-[13px] text-[#D4D4D4] cursor-pointer">Cancel</button>
              <button type="submit" [disabled]="!valid || saving" data-testid="change-password-save"
                class="px-4 py-2 rounded-lg bg-[#4A6FA5] hover:bg-[#6F8FC0] text-[#0A0A0A] text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {{ saving ? 'Saving' : 'Change password' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `
})
export class ChangePasswordModalComponent implements OnDestroy {
  @Output() closed = new EventEmitter<void>();

  current = '';
  next = '';
  confirm = '';
  show = false;
  saving = false;
  error: string | null = null;
  done: string | null = null;
  private redirect: ReturnType<typeof setTimeout> | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  get problem(): string | null {
    return passwordProblem(this.next, this.current);
  }

  get valid(): boolean {
    return !!this.current && !this.problem && this.next === this.confirm;
  }

  close(): void {
    if (!this.saving && !this.done) this.closed.emit();
  }

  async submit(): Promise<void> {
    if (!this.valid || this.saving) return;
    this.saving = true;
    this.error = null;
    try {
      this.done = await this.authService.changePassword(this.current, this.next);
      this.current = this.next = this.confirm = '';
      this.redirect = setTimeout(() => this.router.navigate(['/login']), 1500);
    } catch (err: unknown) {
      this.error = (err instanceof Error && err.message) || 'Could not change the password. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  ngOnDestroy(): void {
    if (this.redirect) clearTimeout(this.redirect);
  }
}
