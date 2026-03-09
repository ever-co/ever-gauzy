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
