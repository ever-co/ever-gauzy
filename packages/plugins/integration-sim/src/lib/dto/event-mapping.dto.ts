import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

/**
 * Supported Gauzy event types that can trigger SIM workflows.
 */
export const SIM_SUPPORTED_EVENTS = [
	'timer.started',
	'timer.stopped',
	'timer.status_updated',
	'task.created',
	'task.updated',
	'task.deleted',
	'screenshot.created',
	'screenshot.updated',
	'screenshot.deleted',
	'integration.created',
	'integration.updated',
	'integration.deleted',
	'account.registered',
	'account.verified'
] as const;

export type SimEventType = (typeof SIM_SUPPORTED_EVENTS)[number];

/**
 * Constant map of SIM event names for use in handlers.
 * Avoids hardcoded string literals that can drift out of sync with SIM_SUPPORTED_EVENTS.
 */
export const SimEventName = {
	TIMER_STARTED: 'timer.started',
	TIMER_STOPPED: 'timer.stopped',
	TIMER_STATUS_UPDATED: 'timer.status_updated',
	TASK_CREATED: 'task.created',
	TASK_UPDATED: 'task.updated',
	TASK_DELETED: 'task.deleted',
	SCREENSHOT_CREATED: 'screenshot.created',
	SCREENSHOT_UPDATED: 'screenshot.updated',
	SCREENSHOT_DELETED: 'screenshot.deleted',
	INTEGRATION_CREATED: 'integration.created',
	INTEGRATION_UPDATED: 'integration.updated',
	INTEGRATION_DELETED: 'integration.deleted',
	ACCOUNT_REGISTERED: 'account.registered',
	ACCOUNT_VERIFIED: 'account.verified'
} as const satisfies Record<string, SimEventType>;

/**
 * Event descriptions map for use in the service layer.
 */
export const SIM_EVENT_DESCRIPTIONS: Record<SimEventType, string> = {
	'timer.started': 'Triggered when an employee starts their timer',
	'timer.stopped': 'Triggered when an employee stops their timer',
	'timer.status_updated': 'Triggered when a timer status is queried and updated',
	'task.created': 'Triggered when a new task is created',
	'task.updated': 'Triggered when a task is updated',
	'task.deleted': 'Triggered when a task is deleted',
	'screenshot.created': 'Triggered when a new screenshot is captured',
	'screenshot.updated': 'Triggered when a screenshot is updated',
	'screenshot.deleted': 'Triggered when a screenshot is deleted',
	'integration.created': 'Triggered when a new integration is created',
	'integration.updated': 'Triggered when an integration is updated',
	'integration.deleted': 'Triggered when an integration is deleted',
	'account.registered': 'Triggered when a new account is registered',
	'account.verified': 'Triggered when an account is verified'
};

export class EventMappingDto {
	@ApiProperty({
		description: 'The Gauzy event type to map',
		enum: SIM_SUPPORTED_EVENTS
	})
	@IsString()
	@IsNotEmpty()
	@IsIn(SIM_SUPPORTED_EVENTS)
	event!: SimEventType;

	@ApiProperty({
		description: 'The SIM workflow ID to trigger when this event fires'
	})
	@IsString()
	@IsNotEmpty()
	workflowId!: string;
}
