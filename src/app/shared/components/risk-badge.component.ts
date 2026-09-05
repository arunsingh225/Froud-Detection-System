import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiskTier } from '../../models/types.model';

@Component({
  selector: 'app-risk-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center gap-1 font-bold font-mono-data uppercase tracking-wider rounded border"
      [ngClass]="[badgeConfig.bg, badgeConfig.text, badgeConfig.border, size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[9px]']"
    >
      <span *ngIf="showDot" class="w-1.5 h-1.5 rounded-full" [ngClass]="badgeConfig.dot"></span>
      {{ tier }}
    </span>
  `
})
export class RiskBadgeComponent {
  @Input() tier: RiskTier = 'Low';
  @Input() size: 'sm' | 'md' = 'sm';
  @Input() showDot: boolean = false;

  get badgeConfig() {
    switch (this.tier) {
      case 'Critical':
        return { bg: 'bg-[#93000a]/20', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/40', dot: 'bg-[#e05353]' };
      case 'High':
        return { bg: 'bg-[#e05353]/15', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/30', dot: 'bg-[#e05353]' };
      case 'Medium':
        return { bg: 'bg-[#C5A059]/15', text: 'text-[#C5A059]', border: 'border-[#C5A059]/30', dot: 'bg-[#C5A059]' };
      case 'Low':
        return { bg: 'bg-[#52b788]/15', text: 'text-[#52b788]', border: 'border-[#52b788]/30', dot: 'bg-[#52b788]' };
      default:
        return { bg: 'bg-[#141414]', text: 'text-[#A3A3A3]', border: 'border-white/10', dot: 'bg-[#737373]' };
    }
  }
}
