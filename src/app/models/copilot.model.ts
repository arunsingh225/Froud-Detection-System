export interface AIWorkflowStep {
  id: string;
  text: string;
  status: 'completed' | 'running' | 'pending';
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content?: string;
  timestamp: string;
  workflow?: {
    title: string;
    steps: AIWorkflowStep[];
  };
  investigationResult?: {
    confidenceScore: number;
    recommendedAction: string;
    recommendedSubAction: string;
    keyFindings: {
      icon: string;
      title: string;
      description: string;
      severity: 'error' | 'warning' | 'info';
    }[];
  };
}
