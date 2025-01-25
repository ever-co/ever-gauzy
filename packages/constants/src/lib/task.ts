/**
 * Enumeration for task proof of completion types.
 * Defines whether the proof of task completion is publicly visible or private.
 */
export enum TaskProofOfCompletionTypeEnum {
	PUBLIC = 'PUBLIC',
	PRIVATE = 'PRIVATE'
}

/**
 * Default period (in days) before sending a notification about a pending task.
 */
export const DEFAULT_TASK_NOTIFY_PERIOD = 7;

/**
 * Default period (in days) before an unresolved issue is automatically closed.
 */
export const DEFAULT_AUTO_CLOSE_ISSUE_PERIOD = 7;

/**
 * Default period (in days) before an inactive issue is automatically archived.
 */
export const DEFAULT_AUTO_ARCHIVE_ISSUE_PERIOD = 7;

/**
 * Default proof of completion type for a task, set to PRIVATE.
 */
export const DEFAULT_PROOF_COMPLETION_TYPE = TaskProofOfCompletionTypeEnum.PRIVATE;
