import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventTypeEnum, EventBus, IntegrationSetting, RequestContext, TaskEvent } from '@gauzy/core';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksEntityLink, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { isIdeaTask } from './ever-works-idea.mapper';
import { runDetached } from '../sync/outbound/ever-works-detached';

/** How long a mapping's "Idea" issue type id is cached. */
const IDEA_TYPE_CACHE_MS = 30_000;

/**
 * Outbound trigger for ideas (plan 03 §C.2): a Gauzy `TaskEvent` of an **idea task** — a task of the
 * "Idea" issue type, or one linked as an idea whose type changed away or that was deleted — enqueues an
 * `IDEA_TASK` change. Other tasks are left to the task sync.
 *
 * Loop guard level 1: an event published while the inbound applier writes is ignored (checked
 * synchronously, in the publisher's own asynchronous context).
 */
@Injectable()
export class EverWorksIdeaTaskCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksIdeas');
	private subscription: Subscription | null = null;
	private readonly ideaTypes = new Map<ID, { id: string; at: number }>();

	constructor(
		private readonly eventBus: EventBus,
		private readonly queue: EverWorksOutboundQueue,
		private readonly dataSource: DataSource
	) {}

	onModuleInit(): void {
		this.subscription = this.eventBus.ofType(TaskEvent).subscribe((event: TaskEvent) => {
			try {
				if (EverWorksSyncContext.isApplying()) return;
				const task = event.entity as
					| { id?: ID; tenantId?: ID; organizationId?: ID; issueType?: string | null; taskTypeId?: ID | null }
					| undefined;
				const input = (event.input ?? {}) as {
					tenantId?: ID;
					organizationId?: ID;
					issueType?: string | null;
					taskTypeId?: ID | null;
				};
				const tenantId = task?.tenantId ?? input.tenantId ?? RequestContext.currentTenantId() ?? undefined;
				const organizationId = task?.organizationId ?? input.organizationId;
				if (!task?.id || !tenantId || !organizationId) return;
				const deleted =
					String(event.type) ===
					String((BaseEntityEventTypeEnum as Record<string, string>)['DELETED'] ?? 'deleted');
				const seen = {
					issueType: task.issueType ?? input.issueType ?? null,
					taskTypeId: task.taskTypeId ?? input.taskTypeId ?? null
				};
				const actorUserId = RequestContext.currentUserId() ?? null;
				// Outside the task write's transaction context (see ever-works-detached.ts); the context reads are done.
				const taskId = task.id;
				void runDetached(() =>
					this.capture(tenantId, organizationId, taskId, seen, deleted, actorUserId)
				).catch((error) =>
					this.logger.warn(
						`An idea task change could not be queued (${error instanceof Error ? error.name : 'error'}).`
					)
				);
			} catch (error) {
				this.logger.warn(
					`A task event could not be captured for ideas (${error instanceof Error ? error.name : 'error'}).`
				);
			}
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}

	private async capture(
		tenantId: ID,
		organizationId: ID,
		taskId: ID,
		seen: { issueType: string | null; taskTypeId: ID | null },
		deleted: boolean,
		actorUserId: ID | null
	): Promise<void> {
		const integrationTenantId = await this.queue.mappingFor(tenantId, organizationId);
		if (!integrationTenantId) return;
		const idea = !deleted && isIdeaTask(seen, await this.ideaTypeOf(integrationTenantId));
		if (!idea) {
			// Not an idea now: only a task linked as one matters (its type changed away, or it was deleted).
			const linked = await this.dataSource
				.getRepository(EverWorksEntityLink)
				.count({ where: { integrationTenantId, entityType: EverWorksLinkType.IDEA_TASK, gauzyId: taskId } });
			if (!linked) return;
		}
		await this.queue.enqueue({
			tenantId,
			organizationId,
			entityType: EverWorksLinkType.IDEA_TASK,
			gauzyId: taskId,
			op: deleted ? 'delete' : 'upsert',
			actorUserId
		});
	}

	/** The mapping's seeded "Idea" issue type id (`IDEA_ISSUE_TYPE_ID`), cached briefly. */
	private async ideaTypeOf(integrationTenantId: ID, now = Date.now()): Promise<string> {
		const cached = this.ideaTypes.get(integrationTenantId);
		if (cached && now - cached.at < IDEA_TYPE_CACHE_MS) return cached.id;
		const row = await this.dataSource.getRepository(IntegrationSetting).findOne({
			where: {
				integrationId: integrationTenantId,
				settingsName: EverWorksSettingName.IDEA_ISSUE_TYPE_ID
			} as never
		});
		const id = row?.settingsValue ?? '';
		this.ideaTypes.set(integrationTenantId, { id, at: now });
		return id;
	}
}
