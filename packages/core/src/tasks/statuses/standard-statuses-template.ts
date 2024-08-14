import { TaskStatusEnum, TaskStatusWorkFlow } from '@gauzy/contracts';

export const TASK_STATUSES_TEMPLATES: { [key in TaskStatusEnum]: TaskStatusWorkFlow } = {
	[TaskStatusEnum.BACKLOG]: { isTodo: true, isInProgress: false, isDone: false },
	[TaskStatusEnum.OPEN]: { isTodo: true, isInProgress: false, isDone: false },
	[TaskStatusEnum.IN_PROGRESS]: { isTodo: false, isInProgress: true, isDone: false },
	[TaskStatusEnum.READY_FOR_REVIEW]: { isTodo: false, isInProgress: true, isDone: false },
	[TaskStatusEnum.IN_REVIEW]: { isTodo: false, isInProgress: true, isDone: false },
	[TaskStatusEnum.BLOCKED]: { isTodo: false, isInProgress: true, isDone: false },
	[TaskStatusEnum.DONE]: { isTodo: false, isInProgress: false, isDone: true },
	[TaskStatusEnum.COMPLETED]: { isTodo: false, isInProgress: false, isDone: true },
	[TaskStatusEnum.CUSTOM]: { isTodo: false, isInProgress: false, isDone: false }
};
