import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-14 h-14 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-[28px] text-[#737373]">{{ icon }}</span>
      </div>
      <h3 class="font-serif italic text-[18px] text-white mb-1">{{ title }}</h3>
      <p *ngIf="description" class="text-[13px] text-[#737373] max-w-xs">{{ description }}</p>
      <button
        *ngIf="actionLabel"
        (click)="actionClick.emit()"
        class="mt-4 px-4 py-2 bg-[#C5A059] hover:bg-[#dfba73] text-[#0A0A0A] text-[12px] font-semibold rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
      >
        {{ actionLabel }}
      </button>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon: string = 'search_off';
  @Input() title: string = 'No results found';
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Output() actionClick = new EventEmitter<void>();
}
