import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import {
	IOutboxWriteInput,
	ITaskLinkClosedEvent,
	TASK_AUTOMATION_EVENT_NAMES,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { EventOutboxService, getORMType, MultiORMEnum, TaskLinkClosedEvent } from '@gauzy/core';
import { ITaskLinkClosureKey, linkClosureKeyOf, linkMergeKeyOf, parseLinkClosedEvent } from '../engine/link-closed';
import { ITaskAutomationMikroOrmTransaction, TaskAutomationLinkClosureStore } from '../services/task-automation-link-closure.store';
import { TaskAutomationRuleService } from '../services/task-automation-rule.service';
import { TaskAutomationTaskReader } from '../services/task-automation-task-reader.service';
import { TASK_AUTOMATION_AGGREGATE, taskAutomationPartitionKey } from '../task-automation.constants';

/**
 * Turns a closed link an integration reports (the platform's `TaskLinkClosedEvent`: the GitHub integration on a closed
 * pull request or issue) into `task_link.closed` on the event outbox, which the consumer hands to the `LINK_CLOSED`
 * rules (spec T16).
 *
 * Once per task and link: the close is claimed in `task_automation_link_closure` in the same transaction the event is
 * appended in, so both commit or neither does — a close is never lost to a stop between them — and the same close
 * delivered again (the provider's redelivery, a second API instance, the item closed again after a reopen) appends
 * nothing. It appends only for a task of the tenant and organization the report names, of an organization with a
 * `LINK_CLOSED` rule switched on (cached a few seconds, as the change capture), in the task's own partition, behind the
 * task's changes. Best effort, as the change capture: nothing is thrown back to the integration.
 *
 * A merged pull request's merge is claimed too, beside its close (spec FR-21): when the pull request was closed without
 * merging before — its close was reported then — its merge after a reopen is appended once more, with
 * `closedBefore: true`, for the rules that wait for a merge (`mergedOnly`) only; the other link rules already ran on
 * the close. A close without merging never takes the merge's claim, so it cannot keep a later merge from those rules.
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
		const mergeKey = linkMergeKeyOf(closed, key);
		return this.claimAndAppend(key, mergeKey, (closedBefore) => {
			// `closedBefore` is the claims' to say, never the integration's.
			const data: ITaskLinkClosedEvent = {
				...closed,
				provider: key.provider,
				externalId: key.externalId,
				closedBefore
			};
			return {
				name: TASK_AUTOMATION_EVENT_NAMES.LINK_CLOSED,
				aggregateType: TASK_AUTOMATION_AGGREGATE,
				aggregateId: key.taskId,
				partitionKey: taskAutomationPartitionKey(key.taskId),
				tenantId: key.tenantId,
				organizationId: key.organizationId,
				data: data as unknown as Record<string, unknown>
			};
		});
	}

	/**
	 * Claims and appends (see {@link claimAndAppendOnce}). A claim another delivery committed first fails the
	 * insert: the unique key decided, and the report is theirs. Whether another delivery made this report is told
	 * by the merge's claim for a merge (the close's may be the one a close without merging took long before, which
	 * says nothing of this delivery), by the close's for a close. A merge whose close another delivery claimed
	 * meanwhile — a close without merging, delivered at the same moment — lost only the close's claim, which was
	 * not its to take: it is tried once more, now as a merge after a reported close.
	 */
	private async claimAndAppend(
		key: ITaskLinkClosureKey,
		mergeKey: ITaskLinkClosureKey | null,
		input: (closedBefore: boolean) => IOutboxWriteInput
	): Promise<boolean> {
		try {
			return await this.claimAndAppendOnce(key, mergeKey, input);
		} catch (error) {
			// Another delivery made this report (the merge's claim tells for a merge, the close's for a close).
			if (await this.closures.exists(mergeKey ?? key)) return false;
			// A close, or a merge whose close nobody claimed either: a real failure (a redelivery reports it again).
			if (!mergeKey || !(await this.closures.exists(key))) throw error;
			// A merge that lost only the close's claim to a close without merging: once more, as a merge after a close.
			try {
				return await this.claimAndAppendOnce(key, mergeKey, input);
			} catch (retryError) {
				if (await this.closures.exists(mergeKey)) return false;
				throw retryError;
			}
		}
	}

	/**
	 * The claims and the append in one transaction of the ORM `DB_ORM` configures (under MikroORM the outbox's TypeORM
	 * entity maps its base columns only, so the row is written through MikroORM, and the claims join that transaction);
	 * the outbox's commit hook then wakes the dispatch pass. The close is claimed, and a merged pull request's merge
	 * beside it; the event is appended when either claim is new, saying whether the close was claimed before.
	 */
	private async claimAndAppendOnce(
		key: ITaskLinkClosureKey,
		mergeKey: ITaskLinkClosureKey | null,
		input: (closedBefore: boolean) => IOutboxWriteInput
	): Promise<boolean> {
		if (getORMType() === MultiORMEnum.MikroORM) {
			const em = this.outbox.mikroOrmEventOutboxRepository?.getEntityManager?.();
			if (em) {
				return em.fork().transactional(async (transaction) => {
					const claim = (claimed: ITaskLinkClosureKey) =>
						this.closures.claimInMikroOrm(
							transaction as unknown as ITaskAutomationMikroOrmTransaction,
							claimed
						);
					const closed = await claim(key);
					const merged = mergeKey ? await claim(mergeKey) : false;
					if (!closed && !merged) return false;
					await this.outbox.append(transaction as never, input(!closed));
					return true;
				});
			}
		}
		return this.dataSource.manager.transaction(async (manager) => {
			const closed = await this.closures.claimIn(manager, key);
			const merged = mergeKey ? await this.closures.claimIn(manager, mergeKey) : false;
			if (!closed && !merged) return false;
			await this.outbox.append(manager, input(!closed));
			return true;
		});
	}
}
