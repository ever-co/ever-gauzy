import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope,
	TASK_AUTOMATION_EVENT_NAMES
} from '@gauzy/contracts';
import { EventConsumerRegistry } from '@gauzy/core';
import { parseChangeEvent } from '../engine/change-capture';
import { parseLinkClosedEvent } from '../engine/link-closed';
import { TaskAutomationEngine } from '../services/task-automation-engine.service';
import { TASK_AUTOMATION_CONSUMER_KEY } from '../task-automation.constants';

/** Where the consumer's specs and callers have always found it; it lives with the engine's pure functions. */
export { parseLinkClosedEvent };

/**
 * The outbox consumer that runs the rules (`subscriber:task-automations`). A delivery is recorded per event before the
 * work, so the event is handed over at most once when it succeeds; a failure of the engine itself (a database blip
 * while claiming a run) is thrown, the delivery is retried, and the rules that already ran for the event are skipped
 * by their run's key. A rule's own failure is its run's outcome, not the delivery's.
 *
 * Reorderable: the claim already hands one task's events over in order (one partition per task), and each rule reads
 * the task as it is when it runs, so a retried delivery that arrives late still acts on the current task.
 *
 * The payload is never trusted for scope: an event whose payload names another tenant or organization than its
 * envelope is dropped.
 */
@Injectable()
export class TaskAutomationEventConsumer implements IEventConsumer, OnApplicationBootstrap {
	readonly key = TASK_AUTOMATION_CONSUMER_KEY;
	readonly kind = EventConsumerKind.SUBSCRIBER;
	readonly ordering = EventConsumerOrdering.REORDERABLE;
	readonly maxAttempts = 5;
	readonly events = [TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED, TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED];

	private readonly logger = new Logger(TaskAutomationEventConsumer.name);

	constructor(
		private readonly registry: EventConsumerRegistry,
		private readonly engine: TaskAutomationEngine
	) {}

	/**
	 * Registers the consumer; a failure fails the boot, so no instance runs without it. The one exception is a second
	 * instance of this same consumer (the scheduler builds the due-date queue's module in an injector of its own): the
	 * first instance serves the key, and the second has nothing to add.
	 */
	onApplicationBootstrap(): void {
		const key = EventConsumerRegistry.consumerKeyOf(this);
		const registered = this.registry.list().find((consumer) => EventConsumerRegistry.consumerKeyOf(consumer) === key);
		if (registered && registered !== this && registered instanceof TaskAutomationEventConsumer) {
			this.logger.debug(`The task automation consumer "${key}" is served by another instance.`);
			return;
		}
		this.registry.register(this);
	}

	async handle(event: IEventEnvelope, context?: IEventConsumerContext): Promise<void> {
		void context;
		if (event?.name === TASK_AUTOMATION_EVENT_NAMES.TASK_CHANGED) {
			const change = parseChangeEvent(event.data);
			if (!change || !this.sameScope(event, change)) {
				this.logger.debug(`Dropped the automation event ${event.id}: no change, or a scope that is not its envelope's.`);
				return;
			}
			await this.engine.processChange(event.id, change);
			return;
		}
		if (event?.name === TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED) {
			const closed = parseLinkClosedEvent(event.data);
			if (!closed || !this.sameScope(event, closed)) return;
			await this.engine.processLinkClosed(event.id, closed);
		}
	}

	private sameScope(event: IEventEnvelope, payload: { tenantId: string; organizationId: string }): boolean {
		if (event.tenantId && String(event.tenantId) !== payload.tenantId) return false;
		if (event.organizationId && String(event.organizationId) !== payload.organizationId) return false;
		return true;
	}
}
