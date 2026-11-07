import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CommentEvent, CreateMentionEvent, EmployeeNotificationCreatedEvent } from '@gauzy/core';
import { RealtimeHintsService } from '../realtime-hints.service';

/** A comment changed: `comment.<created|updated|deleted>`. */
@EventsHandler(CommentEvent)
export class RealtimeCommentEventHandler implements IEventHandler<CommentEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: CommentEvent): Promise<void> {
		await this.hints.onCommentEvent(event);
	}
}

/**
 * Someone was mentioned: `mention.created`, addressed to them. `CreateMentionEvent` is the request the mention
 * handler writes the row from, in the same in-process dispatch; the hint only tells the mentioned user to refetch,
 * so a (logged) failure of that write costs one empty refetch, never a wrong fact.
 */
@EventsHandler(CreateMentionEvent)
export class RealtimeMentionEventHandler implements IEventHandler<CreateMentionEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: CreateMentionEvent): Promise<void> {
		await this.hints.onMention(event.input);
	}
}

/**
 * A notification row exists for an employee: `employee_notification.created`, addressed to them. The created
 * event, not the request to create one: a request the receiver switched off saves nothing and announces nothing.
 */
@EventsHandler(EmployeeNotificationCreatedEvent)
export class RealtimeNotificationEventHandler implements IEventHandler<EmployeeNotificationCreatedEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: EmployeeNotificationCreatedEvent): Promise<void> {
		await this.hints.onNotification(event.notification);
	}
}

export const REALTIME_EVENT_HANDLERS = [
	RealtimeCommentEventHandler,
	RealtimeMentionEventHandler,
	RealtimeNotificationEventHandler
];
