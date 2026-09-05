import { ScreenId } from './types.model';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'investigation' | 'report' | 'approval' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'info';
  isRead: boolean;
  timestamp: string;
  timeAgo: string;
  navigateTo?: ScreenId;
  routePath?: string;
  relatedId?: string;
}
