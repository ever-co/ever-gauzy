import { SetMetadata, Type } from '@nestjs/common';
import { ID } from '@gauzy/contracts';

/**
 * How a task-setting write names the rows it touches, so {@link TaskSettingPermissionGuard} can tell which team it
 * writes in:
 *
 * - `create`: a new row, in the team its payload files it under (`organizationTeamId`, or `organizationTeam.id`).
 * - `update`: a stored row, named by its id — its team, and the team the payload moves it to when it names one.
 * - `stored`: a stored row named by its id, removed, withdrawn or restored — its team.
 * - `markAsDefault`: a stored row made the default of a scope — its team, and the scope's team when the scope names one
 *   (the other rows of that scope lose the mark).
 * - `reorder`: the status board's order — the team of every row the list names.
 */
export type TaskSettingWriteKind = 'create' | 'update' | 'stored' | 'markAsDefault' | 'reorder';

/** The stored task-setting rows a guard reads: the six task-setting services answer these two reads. */
export interface ITaskSettingRows {
	findOneByIdString(id: ID, options?: { withDeleted?: boolean }): Promise<{ organizationTeamId?: ID | null }>;
	find(options: { where: Record<string, unknown> }): Promise<Array<{ id?: ID; organizationTeamId?: ID | null }>>;
}

/** The metadata {@link TaskSettingWrite} attaches to a route or GraphQL field. */
export interface ITaskSettingWrite {
	/** The service whose rows the write touches, read through the module graph by its class. */
	rows: Type<unknown>;
	kind: TaskSettingWriteKind;
}

export const TASK_SETTING_WRITE_METADATA = 'gauzy:task-setting-write';

/**
 * Names the rows a task-setting write touches, for {@link TaskSettingPermissionGuard}: with it, a manager of the team
 * the rows belong to may make the write without the route's own permission (owner decision 2(b), 2026-10-23).
 *
 * @param rows - The task-setting service of the route (`TaskStatusService`, `TaskSizeService`, ...).
 * @param kind - How the write names its rows.
 */
export const TaskSettingWrite = (rows: Type<unknown>, kind: TaskSettingWriteKind) =>
	SetMetadata(TASK_SETTING_WRITE_METADATA, { rows, kind } as ITaskSettingWrite);
