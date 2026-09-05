import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  InvestigationDetailFull,
  InvestigateRequest,
  EvidenceItem,
  InvestigationTimelineStep
} from '../models/ai-investigator.model';
import { CopilotMessage } from '../models/copilot.model';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class AIInvestigatorService {
  private readonly baseUrl = `${environment.apiUrl}/ai-investigator`;
  private readonly investigationsUrl = `${environment.apiUrl}/investigations`;

  activeInvestigation = signal<InvestigationDetailFull | null>(null);
  evidence = signal<EvidenceItem[]>([]);
  timeline = signal<InvestigationTimelineStep[]>([]);
  loading = signal<boolean>(false);
  isGenerating = signal<boolean>(false);
  error = signal<string | null>(null);

  messages = signal<CopilotMessage[]>([]);

  constructor(private http: HttpClient) {}

  runInvestigation(transactionId: string, alertId?: string, prompt?: string): Observable<ApiResponse<InvestigationDetailFull>> {
    const cleanId = (transactionId || '').trim();

    // Strict GUID validation: Never send "TXN-2026-xxxx" or invalid strings
    if (!this.isValidGuid(cleanId)) {
      const err = `[AIInvestigatorService] Invalid transactionId: expected valid GUID, received '${cleanId}'. Aborting request.`;
      console.error(err);
      this.error.set(err);
      return throwError(() => new Error(err));
    }

    this.loading.set(true);
    this.isGenerating.set(true);
    this.error.set(null);

    const payload: { transactionId: string; alertId?: string; prompt?: string } = {
      transactionId: cleanId
    };
    if (alertId && this.isValidGuid(alertId.trim())) {
      payload.alertId = alertId.trim();
    }
    if (prompt && prompt.trim()) {
      payload.prompt = prompt.trim();
    }

    console.log('[AIInvestigatorService] Dispatching POST /api/ai-investigator/investigate with payload:', JSON.stringify(payload));

    return this.http.post<ApiResponse<InvestigationDetailFull>>(`${this.baseUrl}/investigate`, payload).pipe(
      tap(res => {
        this.loading.set(false);
        this.isGenerating.set(false);
        if (res.success && res.data) {
          this.activeInvestigation.set(res.data);
          this.evidence.set(res.data.evidence || []);
          this.timeline.set(res.data.timeline || []);
          this.syncMessagesFromInvestigation(res.data);
        }
      }),
      catchError(err => {
        this.loading.set(false);
        this.isGenerating.set(false);
        const errMsg = err?.error?.message || err?.message || 'Failed to complete AI investigation.';
        this.error.set(errMsg);
        return throwError(() => err);
      })
    );
  }

  loadInvestigation(id: string): Observable<ApiResponse<InvestigationDetailFull>> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<ApiResponse<InvestigationDetailFull>>(`${this.baseUrl}/${id}`).pipe(
      tap(res => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.activeInvestigation.set(res.data);
          this.evidence.set(res.data.evidence || []);
          this.timeline.set(res.data.timeline || []);
          this.syncMessagesFromInvestigation(res.data);
        }
      }),
      catchError(err => {
        this.loading.set(false);
        const errMsg = err?.error?.message || err?.message || 'Failed to load investigation.';
        this.error.set(errMsg);
        return throwError(() => err);
      })
    );
  }

  submitDecision(investigationId: string, decision: string, notes?: string): Observable<ApiResponse<boolean>> {
    this.loading.set(true);
    this.error.set(null);

    const payload = {
      decision,
      notes: notes || `Human sign-off decision: ${decision}`
    };

    return this.http.patch<ApiResponse<boolean>>(`${this.investigationsUrl}/${investigationId}/decision`, payload).pipe(
      tap(res => {
        this.loading.set(false);
        if (res.success && this.activeInvestigation()) {
          const current = this.activeInvestigation()!;
          this.activeInvestigation.set({
            ...current,
            status: 'Resolved',
            resolutionDecision: decision,
            resolutionNotes: notes
          });
        }
      }),
      catchError(err => {
        this.loading.set(false);
        const errMsg = err?.error?.message || err?.message || 'Failed to submit decision.';
        this.error.set(errMsg);
        return throwError(() => err);
      })
    );
  }

  regenerateInvestigation(investigationId: string): Observable<ApiResponse<InvestigationDetailFull>> {
    const cleanId = (investigationId || '').trim();
    if (!this.isValidGuid(cleanId)) {
      const err = `[AIInvestigatorService] Invalid investigationId: expected valid GUID, received '${cleanId}'.`;
      this.error.set(err);
      return throwError(() => new Error(err));
    }
    this.loading.set(true);
    this.isGenerating.set(true);
    this.error.set(null);

    return this.http.post<ApiResponse<InvestigationDetailFull>>(`${this.baseUrl}/${cleanId}/regenerate`, {}).pipe(
      tap(res => {
        this.loading.set(false);
        this.isGenerating.set(false);
        if (res.success && res.data) {
          this.activeInvestigation.set(res.data);
          this.evidence.set(res.data.evidence || []);
          this.timeline.set(res.data.timeline || []);
          this.syncMessagesFromInvestigation(res.data);
        }
      }),
      catchError(err => {
        this.loading.set(false);
        this.isGenerating.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Failed to regenerate investigation.';
        this.error.set(errorMsg);
        return throwError(() => err);
      })
    );
  }

  async sendMessage(prompt: string, txn: Transaction): Promise<void> {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: ts
    };

    this.messages.update(m => [...m, userMsg]);
    this.isGenerating.set(true);
    this.error.set(null);

    try {
      const targetGuid = this.isValidGuid(txn.transactionId)
        ? txn.transactionId
        : (this.isValidGuid(txn.id) ? txn.id : '');

      if (!targetGuid) {
        throw new Error(`Expected valid GUID for transaction, received '${txn.transactionCode || txn.id}'`);
      }

      // Pass user prompt to investigation so it customizes RAG retrieval
      const res = await this.runInvestigation(targetGuid, undefined, prompt).toPromise();
      if (res?.data) {
        // Investigation loaded and synced with prompt-specific results
      }
    } catch (e: any) {
      // Fallback message if error
      this.messages.update(m => [
        ...m,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          content: `Analysis failed: ${this.error() || e?.message || 'Service unreachable.'}`,
          timestamp: ts
        }
      ]);
    } finally {
      this.isGenerating.set(false);
    }
  }

  private syncMessagesFromInvestigation(inv: InvestigationDetailFull): void {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const aiMsg: CopilotMessage = {
      id: `ai-inv-${inv.investigationId}`,
      sender: 'ai',
      timestamp: ts,
      content: inv.summary,
      workflow: {
        title: 'AI-Assisted Multi-Vector Investigation Workflow',
        steps: (inv.timeline || []).map(t => ({
          id: t.timelineId,
          text: `${t.label}: ${t.description}`,
          status: t.status === 'active' ? 'running' : 'completed'
        }))
      },
      investigationResult: {
        confidenceScore: Math.round(inv.confidence * 100),
        recommendedAction: inv.recommendedAction,
        recommendedSubAction: 'Autonomous action prohibited; requires human investigator sign-off.',
        keyFindings: (inv.findings || []).map(f => ({
          icon: f.severity === 'CRITICAL' ? 'report' : 'warning',
          title: f.title,
          description: f.explanation,
          severity: f.severity === 'CRITICAL' ? 'error' : 'warning'
        }))
      }
    };

    this.messages.set([
      {
        id: 'usr-init',
        sender: 'user',
        content: `Investigate transaction ${inv.transactionCode} for customer ${inv.customerName}.`,
        timestamp: ts
      },
      aiMsg
    ]);
  }

  isValidGuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }
}
