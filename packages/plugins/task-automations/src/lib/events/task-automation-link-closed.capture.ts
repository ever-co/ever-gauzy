import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { TASK_AUTOMATION_EVENT_NAMES, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { EventOutboxService, TaskLinkClosedEvent } from '@gauzy/core';
import { linkClosureKeyOf, parseLinkClosedEvent } from '../engine/link-closed';
import { TaskAutomationLinkClosureStore } from '../services/task-automation-link-closure.store';
import { TaskAutomationRuleService } from '../services/task-automation-rule.service';
import { TaskAutomationTaskReader } from '../services/task-automation-task-reader.service';
import { TASK_AUTOMATION_AGGREGATE, taskAutomationPartitionKey } from '../task-automation.constants';
import { appendToOutbox } from './task-automation-outbox';

/**
 * Turns a closed link an integration reports (the platform's `TaskLinkClosedEvent`: the GitHub integration on a closed
 * pull request or issue) into `task_link.closed` on the event outbox, which the consumer hands to the `LINK_CLOSED`
 * rules (spec T16).
 *
 * Once per task and link: the close is claimed in `task_automation_link_closure` before it is appended, so the same
 * close delivered again — the provider's redelivery, a second API instance, the item closed again after a reopen —
 * appends nothing. It appends only for an organization with a `LINK_CLOSED` rule switched on (cached a few seconds, as
 * the change capture) and for a task of the tenant and organization the report names, and then in the task's own
 * partition, behind the task's changes. Best effort, as the change capture: nothing is thrown back to the integration;
 * a failed append gives its claim back, so a later delivery of the close reports it.
 */
@Injectable()
@EventsHandler(TaskLinkClosedEvent)
export class TaskAutomationLinkClosedCapture implements IEventHandler<TaskLinkClosedEvent> {
	private readonly logger = new Logger(TaskAutomationLinkClosedCapture.name);

	constructor(
		private readonly rules: TaskAutomationRuleService,
		private readonly reader: TaskAutomationTaskReader,
		private readonly closures: TaskAutomationLinkClosureStore,
		private readonly outbox: EventOutboxService,
		private readonly dataSource: DataSource
	) {}

	async handle(event: TaskLinkClosedEvent): Promise<void> {
		try {
			await this.report(event?.input);
		} catch (error) {
			this.logger.warn(`A closed link was not handed to the automations: ${(error as Error)?.message}`);
		}
	}

	/** Appends the closed link once; answers whether it did. */
	async report(input: unknown): Promise<boolean> {
		const closed = parseLinkClosedEvent(input);
		const key = closed ? linkClosureKeyOf(closed) : null;
		if (!closed || !key) {
			this.logger.debug('Dropped a closed link that names no task, scope, kind, provider or item.');
			return false;
		}
		// The integration read the task in this scope; it is read again here, so a report never names another tenant's
		// or organization's task (and a mismatched scope never reaches the organization's cached triggers).
		if (!(await this.reader.belongsTo(key.tenantId, key.organizationId, key.taskId))) return false;
		const enabled = await this.rules.enabledTriggers(key.tenantId, key.organizationId);
		if (!enabled.has(TaskAutomationTriggerEnum.LINK_CLOSED)) return false;
		const claim = await this.closures.claim(key);
		if (!claim) return false;
		try {
			await appendToOutbox(this.outbox, this.dataSource, {
				name: TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED,
				aggregateType: TASK_AUTOMATION_AGGREGATE,
				aggregateId: key.taskId,
				partitionKey: taskAutomationPartitionKey(key.taskId),
				tenantId: key.tenantId,
				organizationId: key.organizationId,
				data: { ...closed, provider: key.provider, externalId: key.externalId } as unknown as Record<string, unknown>
			});
		} catch (error) {
			await this.closures.release(claim).catch((released: unknown) =>
				this.logger.warn(`The claim of a closed link could not be given back: ${(released as Error)?.message}`)
			);
			throw error;
		}
		return true;
	}
}
