import { ITimeLog, ITimerStatus } from '@gauzy/contracts';

/**
 * Union type for all possible timer event data types
 */
export type TimerEventDataType = ITimeLog | ITimerStatus;

/**
 * Generic timer event interface
 */
export interface ITimerWebhookEvent<T extends TimerEventDataType = TimerEventDataType> {
  /** The type of event (timer.start, timer.stop, timer.status) */
  event: string;
  data: T;
  timestamp: string;
  tenantId: string;
}

/**
 * Specific event types
 */
export interface ITimerStartEvent extends ITimerWebhookEvent<ITimeLog> {
  event: 'timer.start';
}

export interface ITimerStopEvent extends ITimerWebhookEvent<ITimeLog> {
  event: 'timer.stop';
}

export interface ITimerStatusEvent extends ITimerWebhookEvent<ITimerStatus> {
  event: 'timer.status';
}

/**
 * Timer event type
 */
export type TimerEventType = 'start' | 'stop' | 'status';
