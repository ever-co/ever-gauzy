import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ITaskLinkClosureKey } from '../engine/link-closed';
import { TaskAutomationLinkClosure } from '../entities/task-automation-link-closure.entity';

/** The table of the claims (the migration's). */
export const TASK_AUTOMATION_LINK_CLOSURE_TABLE = 'task_automation_link_closure';

/** A query builder of the SQL client a MikroORM transaction runs on, as far as a claim uses it. */
interface ISqlQuery extends PromiseLike<unknown> {
	where(criteria: Record<string, unknown>): ISqlQuery;
	whereNull(column: string): ISqlQuery;
	first(column: string): PromiseLike<unknown>;
	insert(row: Record<string, unknown>): PromiseLike<unknown>;
}

/** What a claim reads of a MikroORM transaction (`SqlEntityManager` inside `transactional`). */
export interface ITaskAutomationMikroOrmTransaction {
	getTransactionContext?(): ((table: string) => ISqlQuery) | undefined;
	getKnex(): (table: string) => ISqlQuery;
}

/**
 * The closed links already handed to the automations (`task_automation_link_closure`). A close is claimed in the same
 * transaction its `task_link.closed` is appended in, under the unique `(tenantId, taskId, provider, kind, externalId)`:
 * both commit or neither does, so a close is never lost to a stop between them, and the same close delivered again —
 * on this instance or another, at once or later — finds the claim and appends nothing. A merged pull request's merge
 * is claimed the same way, under the kind `pull_request.merged` (spec FR-21).
 */
@Injectable()
export class TaskAutomationLinkClosureStore {
	constructor(private readonly dataSource: DataSource) {}

	private where(key: ITaskLinkClosureKey) {
		return { tenantId: key.tenantId, taskId: key.taskId, provider: key.provider, kind: key.kind, externalId: key.externalId };
	}

	/**
	 * Claims a closed link in the caller's TypeORM transaction; `false` when it was reported before. A claim inserted
	 * meanwhile by another delivery fails the insert (the unique key decides): see {@link exists}.
	 */
	async claimIn(manager: EntityManager, key: ITaskLinkClosureKey): Promise<boolean> {
		const rows = manager.getRepository(TaskAutomationLinkClosure);
		const where = this.where(key);
		if (await rows.findOne({ where: where as never, select: { id: true } as never })) return false;
		await rows.insert({ ...where, organizationId: key.organizationId } as never);
		return true;
	}

	/**
	 * The same claim in the caller's MikroORM transaction (under `DB_ORM=mikro-orm` the outbox is written through
	 * MikroORM, so the claim joins that transaction): through its SQL client, which quotes for the dialect, with the
	 * columns the migration creates (the database fills the timestamps and flags).
	 */
	async claimInMikroOrm(transaction: ITaskAutomationMikroOrmTransaction, key: ITaskLinkClosureKey): Promise<boolean> {
		const sql = transaction.getTransactionContext?.() ?? transaction.getKnex();
		const where = this.where(key);
		if (await sql(TASK_AUTOMATION_LINK_CLOSURE_TABLE).where(where).whereNull('deletedAt').first('id')) return false;
		await sql(TASK_AUTOMATION_LINK_CLOSURE_TABLE).insert({ id: randomUUID(), ...where, organizationId: key.organizationId });
		return true;
	}

	/** Whether a closed link is claimed (read outside the transaction that failed to claim it). */
	async exists(key: ITaskLinkClosureKey): Promise<boolean> {
		const count = await this.dataSource.getRepository(TaskAutomationLinkClosure).count({ where: this.where(key) as never });
		return count > 0;
	}
}
