import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-probability-bar',
    imports: [CommonModule],
    template: `
    <div class="flex items-center gap-2">
      <span class="font-mono-data font-bold text-[13px] min-w-[38px]" [ngClass]="textColor">
        {{ hasValue ? safeValue.toFixed(1) + '%' : '—' }}
      </span>
      <div
        class="flex-1 bg-[#1A1A1A] rounded-full overflow-hidden min-w-[60px]"
        [ngClass]="size === 'md' ? 'h-1.5' : 'h-1'"
      >
        <div
          class="rounded-full transition-all duration-300"
          [ngClass]="size === 'md' ? 'h-1.5' : 'h-1'"
          [style.width.%]="clampedValue"
          [style.backgroundColor]="barColor"
        ></div>
      </div>
    </div>
  `
})
export class ProbabilityBarComponent {
  // API data can legitimately lack a probability (transaction not scored yet): accept null/undefined.
  @Input() value: number | null | undefined = 0;
  @Input() size: 'sm' | 'md' = 'sm';

  get hasValue(): boolean {
    return typeof this.value === 'number' && Number.isFinite(this.value);
  }

  get safeValue(): number {
    return this.hasValue ? (this.value as number) : 0;
  }

  get clampedValue(): number {
    return Math.min(Math.max(this.safeValue, 0), 100);
  }

  get barColor(): string {
    if (!this.hasValue) return '#404040';
    if (this.safeValue >= 90) return '#e05353';
    if (this.safeValue >= 70) return '#C5A059';
    if (this.safeValue >= 50) return '#C5A059';
    return '#52b788';
  }

  get textColor(): string {
    if (!this.hasValue) return 'text-[#737373]';
    if (this.safeValue >= 90) return 'text-[#ffb4ab]';
    if (this.safeValue >= 70) return 'text-[#C5A059]';
    if (this.safeValue >= 50) return 'text-[#C5A059]';
    return 'text-[#52b788]';
  }
}
