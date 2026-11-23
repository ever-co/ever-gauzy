import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { CommentParentAccessPolicy, ICommentParent, ICommentParentReadersPolicy } from '../comment/parent-access';
import { TaskService } from './task.service';

/**
 * Who reads every comment of a task, whoever wrote it: whoever may read the task.
 *
 * A task's comments are written for the people who work on it. The task reads ask `ALL_ORG_VIEW` or `ORG_TASK_VIEW`
 * (`TaskController`) and find a task of the caller's tenant inside their organization boundary, and a task carries no
 * visibility of its own; the real-time channel already tells every such reader when a task's comments change. A caller
 * the task read does not admit keeps reading only the comments they wrote, as before. Posting, editing and removing a
 * task's comments keep the comment API's own rules.
 */
@CommentParentAccessPolicy()
@Injectable()
export class TaskCommentAccessPolicy implements ICommentParentReadersPolicy {
	readonly entity = BaseEntityEnum.Task;
	readonly opensReadsOnly = true as const;
	readonly readPermissions = [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW] as const;

	constructor(private readonly taskService: TaskService) {}

	/** The task by the task read itself; `null` when the caller does not reach it or it does not exist. */
	async findAccessibleParent(entityId: ID): Promise<ICommentParent | null> {
		const task = await this.taskService.findOneByIdString(entityId).catch(nullWhenNotFound);
		if (!task) {
			return null;
		}
		return { id: task.id, organizationId: task.organizationId ?? null };
	}
}

/** A lookup's answer when the task is not there, rather than the task read's 404. */
function nullWhenNotFound(error: unknown): null {
	if (error instanceof NotFoundException) {
		return null;
	}
	throw error;
}
