import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';
import { InrCurrencyPipe } from './pipes/inr-currency.pipe';
import { RiskBadgeComponent } from './components/risk-badge.component';
import { StatusBadgeComponent } from './components/status-badge.component';
import { ProbabilityBarComponent } from './components/probability-bar.component';
import { EmptyStateComponent } from './components/empty-state.component';

function render<T>(type: Type<T>, inputs: Record<string, unknown> = {}): ComponentFixture<T> {
  const fixture = TestBed.createComponent(type);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ComponentFixture<unknown>): HTMLElement => f.nativeElement as HTMLElement;

describe('InrCurrencyPipe', () => {
  const pipe = new InrCurrencyPipe();

  it('formats null, undefined and NaN as zero rupees', () => {
    expect(pipe.transform(null)).toBe('₹0');
    expect(pipe.transform(undefined)).toBe('₹0');
    expect(pipe.transform(NaN)).toBe('₹0');
  });

  it('uses K, L and Cr units at the Indian numbering boundaries', () => {
    expect(pipe.transform(999)).toBe('₹999');
    expect(pipe.transform(1_000)).toBe('₹1.0K');
    expect(pipe.transform(25_000)).toBe('₹25.0K');
    expect(pipe.transform(1_00_000)).toBe('₹1.00 L');
    expect(pipe.transform(8_50_000)).toBe('₹8.50 L');
    expect(pipe.transform(1_00_00_000)).toBe('₹1.00 Cr');
    expect(pipe.transform(35_00_00_000)).toBe('₹35.00 Cr');
  });

  it('does not understate large totals (regression: the crore threshold used to be 100x too large)', () => {
    expect(pipe.transform(3_500_000_000)).toBe('₹350.00 Cr');   // the dashboard's monitored volume
    expect(pipe.transform(25_000_000)).toBe('₹2.50 Cr');
  });

  it('keeps the sign of negative amounts', () => {
    expect(pipe.transform(-5_000)).toBe('-₹5.0K');
    expect(pipe.transform(-250)).toBe('-₹250');
  });

  it('never shows a value that rounds up to the next unit (100.0K or 100.00 L)', () => {
    expect(pipe.transform(99_999)).toBe('₹1.00 L');
    expect(pipe.transform(99_949)).toBe('₹99.9K');
    expect(pipe.transform(9_99_99_999)).toBe('₹10.00 Cr');
    expect(pipe.transform(99_99_999)).toBe('₹1.00 Cr');
  });

  it('prints the full Indian-grouped amount when asked', () => {
    expect(pipe.transform(1234567, true)).toBe('₹12,34,567');
  });
});

describe('RiskBadgeComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RiskBadgeComponent] }));

  it('renders the tier text', () => {
    expect(el(render(RiskBadgeComponent, { tier: 'Critical' })).textContent).toContain('Critical');
  });

  it('uses a different colour class per tier and a neutral one for unknown tiers', () => {
    const cls = (tier: string) => (el(render(RiskBadgeComponent, { tier })).querySelector('span') as HTMLElement).className;
    expect(cls('Critical')).toContain('text-[#ffb4ab]');
    expect(cls('Low')).toContain('text-[#52b788]');
    expect(cls('Medium')).toContain('text-[#C5A059]');
    expect(cls('Bogus')).toContain('text-[#A3A3A3]');   // unknown tier must not look like Low/OK
  });

  it('shows the dot only when requested and switches size classes', () => {
    expect(el(render(RiskBadgeComponent, { tier: 'High' })).querySelectorAll('span span').length).toBe(0);
    const f = render(RiskBadgeComponent, { tier: 'High', showDot: true, size: 'md' });
    expect(el(f).querySelectorAll('span span').length).toBe(1);
    expect((el(f).querySelector('span') as HTMLElement).className).toContain('text-[11px]');
  });
});

describe('StatusBadgeComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [StatusBadgeComponent] }));

  it('colours known statuses and falls back to neutral for unknown ones', () => {
    const cls = (status: string) => (el(render(StatusBadgeComponent, { status })).querySelector('span') as HTMLElement).className;
    expect(cls('Resolved')).toContain('text-[#52b788]');
    expect(cls('Escalated')).toContain('text-[#ffb4ab]');
    expect(cls('Something New')).toContain('text-[#A3A3A3]');
  });

  it('displays the status text', () => {
    expect(el(render(StatusBadgeComponent, { status: 'Under Review' })).textContent).toContain('Under Review');
  });
});

describe('ProbabilityBarComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ProbabilityBarComponent] }));

  const bar = (f: ComponentFixture<unknown>) => el(f).querySelector('.rounded-full.transition-all') as HTMLElement;

  it('shows one decimal and clamps the bar width to 0-100%', () => {
    const f = render(ProbabilityBarComponent, { value: 97.234 });
    expect(el(f).textContent).toContain('97.2%');
    expect(bar(f).style.width).toBe('97.234%');
    expect(bar(render(ProbabilityBarComponent, { value: 140 })).style.width).toBe('100%');
    expect(bar(render(ProbabilityBarComponent, { value: -5 })).style.width).toBe('0%');
  });

  it('changes colour at the 50 / 70 / 90 thresholds', () => {
    const color = (value: number) => bar(render(ProbabilityBarComponent, { value })).style.backgroundColor;
    expect(color(10)).toBe('rgb(82, 183, 136)');    // green
    expect(color(60)).toBe('rgb(197, 160, 89)');    // gold
    expect(color(95)).toBe('rgb(224, 83, 83)');     // red
  });

  it('does not crash when the API provides no probability yet', () => {
    expect(() => render(ProbabilityBarComponent, { value: undefined })).not.toThrow();
    expect(() => render(ProbabilityBarComponent, { value: null })).not.toThrow();
    expect(el(render(ProbabilityBarComponent, { value: undefined })).textContent).toContain('—');
    expect(bar(render(ProbabilityBarComponent, { value: NaN })).style.width).toBe('0%');
  });

  it('still shows a real zero probability as 0.0%', () => {
    expect(el(render(ProbabilityBarComponent, { value: 0 })).textContent).toContain('0.0%');
  });
});

describe('EmptyStateComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EmptyStateComponent] }));

  it('renders defaults without optional description or action', () => {
    const f = render(EmptyStateComponent);
    expect(el(f).textContent).toContain('No results found');
    expect(el(f).querySelector('button')).toBeNull();
  });

  it('emits actionClick when the action button is pressed', () => {
    const f = render(EmptyStateComponent, { actionLabel: 'Clear filters', description: 'Try another search' });
    let clicks = 0;
    f.componentInstance.actionClick.subscribe(() => clicks++);
    (el(f).querySelector('button') as HTMLButtonElement).click();
    expect(clicks).toBe(1);
    expect(el(f).textContent).toContain('Try another search');
  });
});
