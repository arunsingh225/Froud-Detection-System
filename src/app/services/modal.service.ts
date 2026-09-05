import { Injectable, signal } from '@angular/core';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  // SAR Modal State
  sarModalOpen = signal<boolean>(false);
  sarTargetTransaction = signal<Transaction | null>(null);

  // New Investigation Modal State
  newInvestigationModalOpen = signal<boolean>(false);

  openSARModal(txn?: Transaction): void {
    if (txn) {
      this.sarTargetTransaction.set(txn);
    }
    this.sarModalOpen.set(true);
  }

  closeSARModal(): void {
    this.sarModalOpen.set(false);
  }

  openNewInvestigationModal(): void {
    this.newInvestigationModalOpen.set(true);
  }

  closeNewInvestigationModal(): void {
    this.newInvestigationModalOpen.set(false);
  }

  // New Transaction Modal State
  newTransactionModalOpen = signal<boolean>(false);

  openNewTransactionModal(): void {
    this.newTransactionModalOpen.set(true);
  }

  closeNewTransactionModal(): void {
    this.newTransactionModalOpen.set(false);
  }
}
