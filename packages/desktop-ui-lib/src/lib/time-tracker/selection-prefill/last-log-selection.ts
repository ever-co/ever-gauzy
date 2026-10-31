import { ITimeLog } from '@gauzy/contracts';
import { ITimeTrackerFormState } from '../../shared/features/time-tracker-form/time-tracker-form.service';

/** The selectors whose values make up the time tracker's own selection. */
const SELECTOR_FIELDS = ['clientId', 'projectId', 'teamId', 'taskId'] as const;

/** Whether the time tracker has a selection of its own: a client, project, team or task picked. */
export function hasSelection(state: Partial<ITimeTrackerFormState> | null | undefined): boolean {
	return SELECTOR_FIELDS.some((field) => !!state?.[field]);
}

export interface ILastLogSelectionContext {
	/** The time tracker's form as it stands. */
	local: Partial<ITimeTrackerFormState>;
	/** Whether the timer runs on this device. */
	isRunning: boolean;
	/** The employee's timer status on the server (`GET /timesheet/timer/status`). */
	status: { running?: boolean; lastLog?: Partial<ITimeLog> | null } | null | undefined;
	/** The organization the time tracker works in: a log of another organization is never used. */
	organizationId?: string | null;
}

/**
 * The selection a time tracker takes over from the employee's last time log (#7753): a second device, or a fresh
 * install, starts with the client, project, team, task and note the employee last tracked with instead of an empty
 * form. `null` when there is nothing to take over:
 *
 * - the time tracker already has a selection: the user's choice is never overwritten (the note is taken only when
 *   the local one is empty as well);
 * - a timer runs, here or on another device: the remote timer sync already copies its selection and starts;
 * - there is no last log, it belongs to another organization, or it carries nothing to select.
 */
export function selectionFromLastLog(context: ILastLogSelectionContext): Partial<ITimeTrackerFormState> | null {
	const { local, isRunning, status, organizationId } = context;
	const lastLog = status?.lastLog;

	if (!lastLog || isRunning || status.running || hasSelection(local)) {
		return null;
	}
	if (organizationId && lastLog.organizationId && lastLog.organizationId !== organizationId) {
		return null;
	}

	const selection: Partial<ITimeTrackerFormState> = {
		...(lastLog.organizationContactId && { clientId: lastLog.organizationContactId }),
		...(lastLog.projectId && { projectId: lastLog.projectId }),
		...(lastLog.organizationTeamId && { teamId: lastLog.organizationTeamId }),
		...(lastLog.taskId && { taskId: lastLog.taskId }),
		...(!local?.note && lastLog.description && { note: lastLog.description })
	};

	return Object.keys(selection).length > 0 ? selection : null;
}

/** The fields of the Electron store's project settings (the selection the timer starts with) for a form state. */
export interface ITimerProjectConfig {
	organizationContactId?: string;
	projectId?: string;
	organizationTeamId?: string;
	taskId?: string;
	note?: string;
}

/** The project settings to store for the non-empty values of `state`. */
export function toProjectConfig(state: Partial<ITimeTrackerFormState>): ITimerProjectConfig {
	return {
		...(state.clientId && { organizationContactId: state.clientId }),
		...(state.projectId && { projectId: state.projectId }),
		...(state.teamId && { organizationTeamId: state.teamId }),
		...(state.taskId && { taskId: state.taskId }),
		...(state.note && { note: state.note })
	};
}
