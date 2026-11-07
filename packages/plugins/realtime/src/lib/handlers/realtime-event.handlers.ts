import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { CommentEvent, CreateMentionEvent, EmployeeCreateNotificationEvent } from '@gauzy/core';
import { RealtimeHintsService } from '../realtime-hints.service';

/** A comment changed: `comment.<created|updated|deleted>`. */
@EventsHandler(CommentEvent)
export class RealtimeCommentEventHandler implements IEventHandler<CommentEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: CommentEvent): Promise<void> {
		await this.hints.onCommentEvent(event);
	}
}

/** Someone was mentioned: `mention.created`, addressed to them. */
@EventsHandler(CreateMentionEvent)
export class RealtimeMentionEventHandler implements IEventHandler<CreateMentionEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: CreateMentionEvent): Promise<void> {
		await this.hints.onMention(event.input);
	}
}

/** A notification is created for an employee: `employee_notification.created`, addressed to them. */
@EventsHandler(EmployeeCreateNotificationEvent)
export class RealtimeNotificationEventHandler implements IEventHandler<EmployeeCreateNotificationEvent> {
	constructor(private readonly hints: RealtimeHintsService) {}

	async handle(event: EmployeeCreateNotificationEvent): Promise<void> {
		await this.hints.onNotification(event.input);
	}
}

export const REALTIME_EVENT_HANDLERS = [
	RealtimeCommentEventHandler,
	RealtimeMentionEventHandler,
	RealtimeNotificationEventHandler
];
