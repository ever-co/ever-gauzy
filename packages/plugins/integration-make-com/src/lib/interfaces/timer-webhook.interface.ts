import { ID, ITimeLog, ITimerStatus } from '@gauzy/contracts';

/**
 * Union type for all possible timer event data types
 */
export type TimerEventDataType = ITimeLog | ITimerStatus;

/**
 * Timer event type
 */
export type TimerEventType = 'start' | 'stop' | 'status';

/**
 * Generic timer event interface
 */
export interface ITimerWebhookEvent<T extends TimerEventDataType = TimerEventDataType> {
	/** The type of event (timer.start, timer.stop, timer.status) */
	event: string;
	data: T;
	timestamp: string;
	tenantId: ID;
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
