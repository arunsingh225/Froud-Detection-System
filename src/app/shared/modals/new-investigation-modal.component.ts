import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../services/modal.service';
import { TransactionService } from '../../services/transaction.service';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-new-investigation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="modalService.newInvestigationModalOpen()"
      class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      (click)="close()"
    >
      <div
        class="bg-[#0D0D0D] border border-white/10 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl relative text-[#D4D4D4]"
        (click)="$event.stopPropagation()"
      >
        <button
          (click)="close()"
          class="absolute top-4 right-4 text-[#737373] hover:text-white p-1 rounded-lg cursor-pointer"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#141414] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_12px_rgba(197,160,89,0.2)]">
            <span class="material-symbols-outlined text-[22px]">find_in_page</span>
          </div>
          <div>
            <h3 class="font-serif italic text-2xl text-white tracking-tight">Initiate AI Investigation</h3>
            <p class="text-[12px] text-[#A3A3A3]">
              Enter a transaction reference or select a high-risk entity from the live stream.
            </p>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-light uppercase tracking-wider text-[#A3A3A3] block mb-1.5">
            Transaction Identifier or Entity ID
          </label>
          <div class="flex items-center bg-[#141414] rounded-xl px-3.5 py-2.5 border border-white/10 focus-within:border-[#C5A059] transition-all">
            <span class="material-symbols-outlined text-[#737373] text-[18px] mr-2">search</span>
            <input
              type="text"
              [(ngModel)]="txnInput"
              (input)="selectedTxn = null"
              placeholder="e.g. TXN10293 or TXN-8924A"
              class="bg-transparent border-none text-[13px] text-white placeholder-[#737373] w-full focus:outline-none font-mono-data"
            />
          </div>
        </div>

        <div>
          <span class="text-[10px] font-mono-data text-[#737373] uppercase tracking-widest block mb-2">
            Or Select Flagged Queue Item:
          </span>
          <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div
              *ngFor="let txn of transactions"
              (click)="onSelect(txn)"
              class="p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-[12px]"
              [ngClass]="isSelected(txn)
                ? 'bg-[#141414] border-[#C5A059] text-white shadow-[0_0_12px_rgba(197,160,89,0.15)]'
                : 'bg-[#141414]/50 border-white/5 hover:bg-[#141414] text-[#A3A3A3]'"
            >
              <div>
                <div class="font-mono-data font-bold text-white flex items-center gap-2">
                  <span>{{ txn.id }}</span>
                  <span class="text-[9px] text-[#ffb4ab] bg-[#e05353]/15 border border-[#e05353]/30 px-1.5 py-0.5 rounded">
                    {{ txn.probability }}% Risk
                  </span>
                </div>
                <div class="text-[11px] text-[#737373]">{{ txn.customerName }} • {{ txn.location }}</div>
              </div>

              <div class="text-right font-mono-data font-bold text-white">
                <!-- Safe optional chaining to prevent crash if amountUsd is undefined -->
                {{ txn.amountUsd ? ('$' + txn.amountUsd.toLocaleString()) : '₹' + txn.amountInr.toLocaleString('en-IN') }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            (click)="close()"
            class="px-4 py-2 bg-[#141414] hover:bg-[#1C1C1C] text-white rounded-lg text-[11px] uppercase tracking-wider font-semibold border border-white/10 cursor-pointer"
          >
            Cancel
          </button>
          <button
            (click)="handleStart()"
            [disabled]="!txnInput.trim() && !selectedTxn"
            class="px-5 py-2.5 bg-[#C5A059] hover:bg-[#dfba73] disabled:opacity-40 text-[#0A0A0A] font-bold uppercase tracking-[0.15em] rounded-lg text-[11px] transition-all shadow-[0_0_16px_rgba(197,160,89,0.25)] flex items-center gap-2 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[18px]">psychology</span>
            <span>Launch AI Investigation</span>
          </button>
        </div>
      </div>
    </div>
  `
})
export class NewInvestigationModalComponent {
  txnInput = '';
  selectedTxn: Transaction | null = null;

  constructor(
    public modalService: ModalService,
    private transactionService: TransactionService,
    private router: Router
  ) {}

  get transactions(): Transaction[] {
    return this.transactionService.getTransactions();
  }

  onSelect(txn: Transaction): void {
    this.selectedTxn = txn;
    this.txnInput = txn.id;
  }

  isSelected(txn: Transaction): boolean {
    return this.selectedTxn?.id === txn.id || this.txnInput.toUpperCase() === txn.id;
  }

  close(): void {
    this.modalService.closeNewInvestigationModal();
    this.txnInput = '';
    this.selectedTxn = null;
  }

  handleStart(): void {
    let target = this.selectedTxn;
    if (!target && this.txnInput.trim()) {
      const match = this.transactions.find(
        t => t.id.toLowerCase() === this.txnInput.trim().toLowerCase()
      );
      target = match ?? {
        ...this.transactions[0],
        id: this.txnInput.trim().toUpperCase()
      };
    }

    if (target) {
      this.transactionService.selectTransaction(target);
      this.close();
      this.router.navigate(['/ai-investigator']);
    }
  }
}
