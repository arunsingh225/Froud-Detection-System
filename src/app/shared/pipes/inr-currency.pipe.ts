import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'inrCurrency',
  standalone: true
})
export class InrCurrencyPipe implements PipeTransform {
  transform(amount: number | null | undefined, full: boolean = false): string {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0';
    }

    if (full) {
      return `₹${amount.toLocaleString('en-IN')}`;
    }

    if (amount >= 10_00_00_000) {
      return `₹${(amount / 10_00_00_000).toFixed(2)} Cr`;
    }
    if (amount >= 1_00_000) {
      return `₹${(amount / 1_00_000).toFixed(2)} L`;
    }
    if (amount >= 1_000) {
      return `₹${(amount / 1_000).toFixed(1)}K`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  }
}
