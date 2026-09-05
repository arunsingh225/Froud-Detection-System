import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-block font-medium rounded border whitespace-nowrap"
      [ngClass]="[styleConfig.bg, styleConfig.text, styleConfig.border, size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[11px]']"
    >
      {{ status }}
    </span>
  `
})
export class StatusBadgeComponent {
  @Input() status: string = 'Pending';
  @Input() size: 'sm' | 'md' = 'sm';

  private readonly styles: Record<string, { bg: string; text: string; border: string }> = {
    'Pending Review': { bg: 'bg-[#C5A059]/10', text: 'text-[#C5A059]', border: 'border-[#C5A059]/25' },
    'Investigating': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25' },
    'Escalated': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' },
    'Resolved': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'Frozen': { bg: 'bg-[#93000a]/20', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/40' },
    'Approved': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'Rejected': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' },
    'New': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25' },
    'Pending': { bg: 'bg-[#C5A059]/10', text: 'text-[#C5A059]', border: 'border-[#C5A059]/25' },
    'Open': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' },
    'Draft': { bg: 'bg-[#737373]/15', text: 'text-[#A3A3A3]', border: 'border-[#737373]/25' },
    'Published': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'Under Review': { bg: 'bg-[#C5A059]/10', text: 'text-[#C5A059]', border: 'border-[#C5A059]/25' },
    'Archived': { bg: 'bg-[#737373]/15', text: 'text-[#A3A3A3]', border: 'border-[#737373]/25' },
    'Active': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'Suspended': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' },
    'Verified': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'Failed': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' },
    'SUCCESS': { bg: 'bg-[#52b788]/10', text: 'text-[#52b788]', border: 'border-[#52b788]/25' },
    'PENDING': { bg: 'bg-[#C5A059]/10', text: 'text-[#C5A059]', border: 'border-[#C5A059]/25' },
    'FAILED': { bg: 'bg-[#e05353]/10', text: 'text-[#ffb4ab]', border: 'border-[#e05353]/25' }
  };

  get styleConfig() {
    return this.styles[this.status] ?? { bg: 'bg-[#141414]', text: 'text-[#A3A3A3]', border: 'border-white/10' };
  }
}
