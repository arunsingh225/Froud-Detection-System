import { Pipe, PipeTransform } from '@angular/core';

const THOUSAND = 1_000;
const LAKH = 1_00_000;
const CRORE = 1_00_00_000;   // 1 crore = 10^7 (not 10^9)

@Pipe({
  name: 'inrCurrency',
  standalone: true
})
export class InrCurrencyPipe implements PipeTransform {
  transform(amount: number | null | undefined, full: boolean = false): string {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) {
      return '₹0';
    }

    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);

    if (full) {
      return `${sign}₹${abs.toLocaleString('en-IN')}`;
    }

    // Pick the unit AFTER rounding, so e.g. 99,999 reads "₹1.00 L" and never "₹100.0K".
    if (abs >= CRORE || Number((abs / LAKH).toFixed(2)) >= 100) {
      return `${sign}₹${(abs / CRORE).toFixed(2)} Cr`;
    }
    if (abs >= LAKH || Number((abs / THOUSAND).toFixed(1)) >= 100) {
      return `${sign}₹${(abs / LAKH).toFixed(2)} L`;
    }
    if (abs >= THOUSAND) {
      return `${sign}₹${(abs / THOUSAND).toFixed(1)}K`;
    }
    return `${sign}₹${abs.toLocaleString('en-IN')}`;
  }
}
