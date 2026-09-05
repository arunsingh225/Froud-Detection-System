import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, ThemeMode } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 100%;
    }
  `],
  template: `
    <div class="w-full min-h-full bg-[#0A0A0A] text-[#D4D4D4] p-4 lg:p-8 pb-12 space-y-6">
      <!-- Toast feedback -->
      <div
        *ngIf="toastMsg"
        class="fixed bottom-6 right-6 z-50 bg-[#141414] border border-[#C5A059] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in"
      >
        <span class="material-symbols-outlined text-[#C5A059]">task_alt</span>
        <span class="text-[13px]">{{ toastMsg }}</span>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="font-serif italic text-2xl lg:text-3xl text-white tracking-tight">System Settings & Policies</h2>
          <p class="text-[13px] text-[#A3A3A3] mt-0.5">
            Configure appearance, autonomous guardrails, human review policies, and inference parameters.
          </p>
        </div>

        <button
          (click)="saveSettings()"
          class="flex items-center gap-2 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] px-4 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.15em] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] active:scale-95 cursor-pointer"
        >
          <span class="material-symbols-outlined text-[17px]">save</span>
          <span>Save Policy Configuration</span>
        </button>
      </div>

      <!-- Section 1: Appearance & Theme -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-6 space-y-4">
        <h3 class="font-serif italic text-lg text-white">Appearance & Theme</h3>
        <p class="text-[12px] text-[#A3A3A3]">
          Choose between Dark Obsidian Mode and Light Paper Mode. Settings persist to your browser profile.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <!-- Dark Option -->
          <div
            (click)="themeService.setTheme('dark')"
            class="p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4"
            [ngClass]="themeService.isDark()
              ? 'bg-[#141414] border-[#C5A059] shadow-[0_0_16px_rgba(197,160,89,0.2)]'
              : 'bg-[#141414]/40 border-white/5 hover:border-white/20'"
          >
            <div class="w-10 h-10 rounded-lg bg-[#0A0A0A] border border-white/10 flex items-center justify-center text-[#C5A059]">
              <span class="material-symbols-outlined text-[22px]">dark_mode</span>
            </div>
            <div>
              <div class="text-white font-semibold text-[13px]">Dark Obsidian</div>
              <div class="text-[11px] text-[#737373]">Optimized for low-light trading rooms</div>
            </div>
          </div>

          <!-- Light Option -->
          <div
            (click)="themeService.setTheme('light')"
            class="p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4"
            [ngClass]="!themeService.isDark()
              ? 'bg-[#141414] border-[#C5A059] shadow-[0_0_16px_rgba(197,160,89,0.2)]'
              : 'bg-[#141414]/40 border-white/5 hover:border-white/20'"
          >
            <div class="w-10 h-10 rounded-lg bg-[#F7F6F2] border border-black/10 flex items-center justify-center text-[#9C782B]">
              <span class="material-symbols-outlined text-[22px]">light_mode</span>
            </div>
            <div>
              <div class="text-white font-semibold text-[13px]">Light Paper</div>
              <div class="text-[11px] text-[#737373]">High-contrast daylight view</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Autonomous Guardrails & Human-in-the-Loop Safety -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-serif italic text-lg text-white">Autonomous Guardrails & Human Review Policies</h3>
            <p class="text-[12px] text-[#A3A3A3] mt-0.5">
              Configure how the platform flags suspicious activity and coordinates mandatory investigator sign-off.
            </p>
          </div>
          <span class="text-[10px] font-mono-data bg-[#52b788]/10 text-[#52b788] border border-[#52b788]/25 px-2 py-0.5 rounded">
            HUMAN-IN-THE-LOOP ACTIVE
          </span>
        </div>

        <div class="divide-y divide-white/5">
          <!-- Policy 1: Replaced Auto-Freeze with Auto-Flag for Review -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div class="max-w-xl">
              <div class="text-white font-medium text-[13px] flex items-center gap-2">
                <span>Auto-Flag for Review (>95% Risk)</span>
                <span class="text-[9px] font-mono-data text-[#C5A059] bg-[#C5A059]/10 px-1.5 py-0.2 rounded border border-[#C5A059]/30">
                  SAFETY GUARDRAIL
                </span>
              </div>
              <p class="text-[11px] text-[#737373] mt-0.5">
                Automatically queue critical-risk transactions for mandatory human review before any account action. Never autonomously freezes customer accounts.
              </p>
            </div>
            <input
              type="checkbox"
              [(ngModel)]="autoFlagForReview"
              class="w-5 h-5 accent-[#C5A059] rounded cursor-pointer"
            />
          </div>

          <!-- Policy 2 -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div class="max-w-xl">
              <div class="text-white font-medium text-[13px]">AI SAR Pre-Drafting</div>
              <p class="text-[11px] text-[#737373] mt-0.5">
                Generate synthetic FinCEN Form 111 drafts for investigator and compliance officer review.
              </p>
            </div>
            <input
              type="checkbox"
              [(ngModel)]="autoDraftSAR"
              class="w-5 h-5 accent-[#C5A059] rounded cursor-pointer"
            />
          </div>

          <!-- Policy 3 -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div class="max-w-xl">
              <div class="text-white font-medium text-[13px]">Impossible Travel Velocity Check</div>
              <p class="text-[11px] text-[#737373] mt-0.5">
                Calculate minimum supersonic transit speeds between successive transactions to flag credential sharing.
              </p>
            </div>
            <input
              type="checkbox"
              [(ngModel)]="impossibleTravel"
              class="w-5 h-5 accent-[#C5A059] rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <!-- Section 3: Detection Sensitivity -->
      <div class="bg-[#0D0D0D] border border-white/5 rounded-xl p-6 space-y-4">
        <h3 class="font-serif italic text-lg text-white">Detection Threshold Sensitivity</h3>
        <p class="text-[12px] text-[#A3A3A3]">
          Adjust the ML confidence cut-off at which transactions trigger a Tier-2 investigation.
        </p>

        <div class="max-w-md space-y-2">
          <div class="flex justify-between text-[12px]">
            <span class="text-[#737373]">Threshold Trigger</span>
            <span class="text-[#C5A059] font-mono-data font-bold">{{ threshold }}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            [(ngModel)]="threshold"
            class="w-full accent-[#C5A059] cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-[#737373] font-mono-data">
            <span>50% (High Recall / More Flags)</span>
            <span>95% (High Precision / Less Noise)</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  autoFlagForReview = true;
  autoDraftSAR = true;
  impossibleTravel = true;
  threshold = 75;
  toastMsg = '';

  constructor(public themeService: ThemeService) {}

  saveSettings(): void {
    this.toastMsg = 'Policy configuration updated and saved to cluster';
    setTimeout(() => {
      this.toastMsg = '';
    }, 3000);
  }
}
