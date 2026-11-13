import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ITaskLinkClosureKey } from '../engine/link-closed';
import { TaskAutomationLinkClosure } from '../entities/task-automation-link-closure.entity';

/**
 * The closed links already handed to the automations (`task_automation_link_closure`). A close is claimed before its
 * `task_link.closed` is appended, under the unique `(tenantId, taskId, provider, kind, externalId)`: the same close
 * delivered again, on this instance or another, finds the claim and appends nothing. A claim whose event could not be
 * appended is given back, so a later delivery of the close reports it.
 */
@Injectable()
export class TaskAutomationLinkClosureStore {
	constructor(private readonly dataSource: DataSource) {}

	private get rows() {
		return this.dataSource.getRepository(TaskAutomationLinkClosure);
	}

	private where(key: ITaskLinkClosureKey) {
		return { tenantId: key.tenantId, taskId: key.taskId, provider: key.provider, kind: key.kind, externalId: key.externalId };
	}

	/** Claims a closed link of a task, or answers `null` when it was reported before. */
	async claim(key: ITaskLinkClosureKey): Promise<TaskAutomationLinkClosure | null> {
		const where = this.where(key);
		if (await this.rows.findOne({ where: where as never, select: { id: true } as never })) return null;
		try {
			return await this.rows.save(this.rows.create({ ...where, organizationId: key.organizationId } as Partial<TaskAutomationLinkClosure>));
		} catch (error) {
			// Another delivery inserted it between the read and here: the unique key decided, and the report is theirs.
			if (await this.rows.findOne({ where: where as never, select: { id: true } as never })) return null;
			throw error;
		}
	}

	/** Gives a claim back: its event could not be appended, and the next delivery of the close is to report it. */
	async release(claim: Pick<TaskAutomationLinkClosure, 'id'>): Promise<void> {
		await this.rows.delete({ id: claim.id } as never);
	}
}
