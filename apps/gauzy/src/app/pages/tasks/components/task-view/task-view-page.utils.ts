import * as moment from 'moment-timezone';
import {
	ITaskLinkedIssue,
	ITaskStatus,
	ITimeLog,
	TaskRelatedIssuesRelationEnum,
	TaskStatusEnum,
	TimeLogType
} from '@gauzy/contracts';
import { IRecordViewStatus } from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from '../../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import { formatDuration, IPersonChip, personOf } from '../../../projects/components/project-view/project-view.utils';
import { isTaskFinished, taskStatusOf } from './task-view-sections';

/**
 * The task page's pure helpers: its linked issues, its recent time entries, its hours per day and its time
 * tracking, each worked out from what the server answered.
 */

/* ── New subtasks ── */

/**
 * The status a new subtask starts in, among the statuses its project takes (in their order): the one marked the
 * default, else Open as the task dialog starts, else the first to-do — Backlog comes before Open and is also a
 * to-do, so a plain "first to-do" would file it there — else the first. None without any read.
 */
export function newTaskStatusOf(statuses: ITaskStatus[]): ITaskStatus | undefined {
	return (
		statuses.find((item) => item.isDefault) ||
		statuses.find((item) => item.value === TaskStatusEnum.OPEN) ||
		statuses.find((item) => item.isTodo) ||
		statuses[0]
	);
}

/* ── Linked issues ── */

/**
 * A link reads "taskFrom {action} taskTo" (A blocks B). Seen from the task at its `taskTo` end, the relation
 * turns round: B is blocked by A.
 */
const INVERSE_RELATIONS: Record<TaskRelatedIssuesRelationEnum, TaskRelatedIssuesRelationEnum> = {
	[TaskRelatedIssuesRelationEnum.BLOCKS]: TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY,
	[TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY]: TaskRelatedIssuesRelationEnum.BLOCKS,
	[TaskRelatedIssuesRelationEnum.CLONES]: TaskRelatedIssuesRelationEnum.IS_CLONED_BY,
	[TaskRelatedIssuesRelationEnum.IS_CLONED_BY]: TaskRelatedIssuesRelationEnum.CLONES,
	[TaskRelatedIssuesRelationEnum.DUPLICATES]: TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY,
	[TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY]: TaskRelatedIssuesRelationEnum.DUPLICATES,
	[TaskRelatedIssuesRelationEnum.RELATES_TO]: TaskRelatedIssuesRelationEnum.RELATES_TO
};

/** Each relation's i18n key, from the task's side: "Blocks", "Is blocked by", … */
export const LINKED_ISSUE_LABELS: Record<TaskRelatedIssuesRelationEnum, string> = {
	[TaskRelatedIssuesRelationEnum.BLOCKS]: 'TASK_VIEW.LINKS.BLOCKS',
	[TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY]: 'TASK_VIEW.LINKS.IS_BLOCKED_BY',
	[TaskRelatedIssuesRelationEnum.CLONES]: 'TASK_VIEW.LINKS.CLONES',
	[TaskRelatedIssuesRelationEnum.IS_CLONED_BY]: 'TASK_VIEW.LINKS.IS_CLONED_BY',
	[TaskRelatedIssuesRelationEnum.DUPLICATES]: 'TASK_VIEW.LINKS.DUPLICATES',
	[TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY]: 'TASK_VIEW.LINKS.IS_DUPLICATED_BY',
	[TaskRelatedIssuesRelationEnum.RELATES_TO]: 'TASK_VIEW.LINKS.RELATES_TO'
};

/** What holds the task up first, then what it holds up, then the rest. */
const RELATION_ORDER: TaskRelatedIssuesRelationEnum[] = [
	TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY,
	TaskRelatedIssuesRelationEnum.BLOCKS,
	TaskRelatedIssuesRelationEnum.RELATES_TO,
	TaskRelatedIssuesRelationEnum.DUPLICATES,
	TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY,
	TaskRelatedIssuesRelationEnum.CLONES,
	TaskRelatedIssuesRelationEnum.IS_CLONED_BY
];

/** One linked task, as the Linked issues panel lists it. */
export interface ILinkedIssueRow {
	/** The link's id. */
	id: string;
	taskId: string;
	key: string;
	title: string;
	status: IRecordViewStatus | null;
	done: boolean;
}

/** The linked tasks under one relation. */
export interface ILinkedIssueGroup {
	relation: TaskRelatedIssuesRelationEnum;
	label: string;
	rows: ILinkedIssueRow[];
}

/**
 * The task's links, grouped by relation as read from the task's side: `outgoing` are the links it starts
 * (`taskFrom` is the task), `incoming` the links that end at it. A link to a task the read did not bring, or
 * back to the task itself, is left out; a task linked twice the same way is listed once.
 */
export function linkedIssueGroupsOf(
	outgoing: ITaskLinkedIssue[],
	incoming: ITaskLinkedIssue[],
	taskId: string,
	hash: (value: number | string) => string
): ILinkedIssueGroup[] {
	const groups = new Map<TaskRelatedIssuesRelationEnum, ILinkedIssueGroup>();
	const seen = new Set<string>();
	const add = (link: ITaskLinkedIssue, relation: TaskRelatedIssuesRelationEnum, other: ITaskLinkedIssue['taskTo']) => {
		if (!other?.id || other.id === taskId || !LINKED_ISSUE_LABELS[relation]) return;
		const key = `${relation}:${other.id}`;
		if (seen.has(key)) return;
		seen.add(key);
		if (!groups.has(relation)) {
			groups.set(relation, { relation, label: LINKED_ISSUE_LABELS[relation], rows: [] });
		}
		// `taskNumber` is a server-side virtual column (prefix + number), absent from ITask.
		const number = (other as any).taskNumber;
		groups.get(relation).rows.push({
			id: link.id,
			taskId: other.id,
			key: number ? hash(number) : '',
			title: other.title,
			status: taskStatusOf(other),
			done: isTaskFinished(other)
		});
	};
	for (const link of outgoing || []) add(link, Number(link.action), link.taskTo);
	for (const link of incoming || []) add(link, INVERSE_RELATIONS[Number(link.action) as TaskRelatedIssuesRelationEnum], link.taskFrom);
	return RELATION_ORDER.filter((relation) => groups.has(relation)).map((relation) => groups.get(relation));
}

/* ── Time ── */

/** One time entry, as the Recent time entries panel lists it. */
export interface ITimeEntryRow {
	id: string;
	person: IPersonChip | null;
	/** The employee's page; none without an employee. */
	personLink: string[] | null;
	/** "Mon, Oct 26". */
	date: string;
	/** "09:00 – 11:30", or "09:00 –" while running. */
	range: string;
	/** "2h 30m". */
	duration: string;
	manual: boolean;
	running: boolean;
	/** Share of the time with keyboard or mouse activity, 0–100; `null` for a manual entry or no slots. */
	activity: number | null;
}

/**
 * The newest time entries first, at most `limit`. A running entry counts until now. The activity is the time
 * slots' active seconds over their seconds, as the Teams dashboard sums them.
 */
export function timeEntriesOf(logs: ITimeLog[], limit = 8, now: Date = new Date()): ITimeEntryRow[] {
	return [...(logs || [])]
		.filter((log) => !!log?.startedAt)
		.sort((a, b) => moment(b.startedAt).valueOf() - moment(a.startedAt).valueOf())
		.slice(0, limit)
		.map((log) => {
			const start = moment(log.startedAt);
			const running = !!log.isRunning || !log.stoppedAt;
			const end = running ? moment(now) : moment(log.stoppedAt);
			const seconds = Number(log.duration) || Math.max(0, end.diff(start, 'seconds'));
			const manual = log.logType === TimeLogType.MANUAL;
			const slots = log.timeSlots || [];
			const slotSeconds = slots.reduce((sum, slot) => sum + (Number(slot.duration) || 0), 0);
			const activeSeconds = slots.reduce((sum, slot) => sum + (Number(slot.overall) || 0), 0);
			const person = personOf(log.employee);
			return {
				id: log.id,
				person,
				personLink: log.employee?.id ? ['/pages/employees/view', log.employee.id] : null,
				date: start.format('ddd, ll'),
				range: `${start.format('LT')} – ${running ? '' : end.format('LT')}`.trim(),
				duration: formatDuration(seconds),
				manual,
				running,
				activity:
					manual || !slotSeconds ? null : Math.min(100, Math.max(0, Math.round((activeSeconds / slotSeconds) * 100)))
			};
		});
}

/**
 * The daily chart's rows as the hours chart draws them, one bar a day: tracked (resumed included) and manual
 * hours, labelled by date.
 */
export function hoursDaysOf(rows: any): IEmployeeHoursDay[] {
	return (Array.isArray(rows) ? rows : []).map((row: any) => ({
		label: moment(row.date).format('D MMM'),
		tracked: (Number(row.value?.[TimeLogType.TRACKED]) || 0) + (Number(row.value?.[TimeLogType.RESUMED]) || 0),
		manual: Number(row.value?.[TimeLogType.MANUAL]) || 0
	}));
}

/** The task's time against its estimate, as Jira's time tracking reads it. */
export interface ITimeTracking {
	/** "3h 05m". */
	logged: string;
	/** "8h 00m"; `null` without an estimate. */
	estimate: string | null;
	/** "4h 55m" left; `null` without an estimate, or once over it. */
	remaining: string | null;
	/** "1h 10m" over the estimate; `null` until then. */
	over: string | null;
	/** Logged share of the estimate, 0–100 for the bar; `null` without an estimate. */
	fill: number | null;
}

export function timeTrackingOf(workedSeconds: number, estimateSeconds: number | null | undefined): ITimeTracking {
	const worked = Math.max(0, Number(workedSeconds) || 0);
	const estimate = Math.max(0, Number(estimateSeconds) || 0);
	if (!estimate) {
		return { logged: formatDuration(worked), estimate: null, remaining: null, over: null, fill: null };
	}
	return {
		logged: formatDuration(worked),
		estimate: formatDuration(estimate),
		remaining: worked <= estimate ? formatDuration(estimate - worked) : null,
		over: worked > estimate ? formatDuration(worked - estimate) : null,
		fill: Math.min(100, (worked / estimate) * 100)
	};
}
