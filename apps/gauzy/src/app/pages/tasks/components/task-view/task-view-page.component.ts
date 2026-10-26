import { ChangeDetectionStrategy, Component, HostBinding, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import {
	BaseEntityEnum,
	IOrganization,
	IPagination,
	ITask,
	ITaskLinkedIssue,
	ITaskStatus,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, toParams, toUtcOffset } from '@gauzy/ui-core/common';
import {
	Store,
	TasksService,
	TimesheetService,
	TimesheetStatisticsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	AddTaskDialogComponent,
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	RecordViewPageState,
	recordViewPageStateOf,
	TimeZoneService
} from '@gauzy/ui-core/shared';
import { IEmployeeHoursDay } from '../../../employees/view-employee/employee-hours-chart/employee-hours-chart.component';
import {
	failed,
	formatDuration,
	ITaskWorker,
	Loadable,
	loaded,
	loading,
	scopedTaskStatusesOf,
	taskWorkersOf
} from '../../../projects/components/project-view/project-view.utils';
import { buildTaskViewSections, isTaskFinished, taskStatusOf, TASK_VIEW_RELATIONS } from './task-view-sections';
import {
	hoursDaysOf,
	ILinkedIssueGroup,
	ITimeEntryRow,
	ITimeTracking,
	linkedIssueGroupsOf,
	timeEntriesOf,
	timeTrackingOf
} from './task-view-page.utils';

/** The relations the page reads: the View's, and the subtasks with their status. */
export const TASK_PAGE_RELATIONS: string[] = [...TASK_VIEW_RELATIONS, 'children', 'children.taskStatus'];

/** Days the hours chart covers. */
export const HOURS_DAYS = 14;
/** Days the recent time entries are read over. */
export const ENTRIES_DAYS = 30;

/** One subtask, as the Subtasks panel lists it. */
export interface ISubtaskRow {
	id: string;
	key: string;
	title: string;
	status: IRecordViewStatus | null;
	done: boolean;
}

/** The subtasks done out of all of them. */
export interface ISubtaskCount {
	done: number;
	total: number;
	/** Done share, 0–100. */
	percent: number;
}

/**
 * A task on its own full-width page, `/pages/tasks/view/:id` (handover §4.P): what a task favorite in the
 * sidebar opens, and where the task drawer's "expand to full width" icon leads. The URL is the task's —
 * bookmark it, share it, reload it.
 *
 * Laid out as Jira's issue page: a breadcrumb, the title and the actions — the status, Edit and Copy link —
 * across the top; the work in the wide column — the description, the hours per day as Hubstaff charts them,
 * the subtasks and the linked issues; and the facts in the side column — the details, the time tracking with
 * who worked most and the recent time entries, then the stamps.
 *
 * The page belongs to the organization selected in the header, like the task lists: a task of another
 * organization reads "not found" (its favorite star would otherwise file it under the wrong organization),
 * and switching the organization reloads the page, discarding any load still in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-view-page',
	templateUrl: './task-view-page.component.html',
	styleUrls: [
		'../../../employees/view-employee/view-employee.component.scss',
		'../../../projects/components/project-quick-look/project-quick-look.component.scss',
		'../../../projects/components/project-view/project-view-page.component.scss',
		'./task-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TaskViewPageComponent extends TranslationBaseComponent implements OnInit {
	/** The project page's page layout: headline, two columns, then the compact sections. */
	@HostBinding('class.is-page') readonly isPage = true;

	readonly favoriteEntity = BaseEntityEnum.Task;
	readonly hoursDays = HOURS_DAYS;
	readonly entriesDays = ENTRIES_DAYS;
	/** The list a task belongs to, for the page's back button. */
	readonly backLink = '/pages/tasks/dashboard';

	task: ITask = null;
	status: IRecordViewStatus = null;
	/** The description, in the wide column. */
	mainSections: IRecordViewSection[] = [];
	/** The details, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];
	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;

	subtasks: ISubtaskRow[] = [];
	subtaskCount: ISubtaskCount | null = null;

	/** The time worked against the estimate, once read. */
	tracking: Loadable<ITimeTracking | null> = loading(null);
	/** The people who worked most on the task, once read. */
	workers: ITaskWorker[] = [];
	hours: Loadable<IEmployeeHoursDay[]> = loading([]);
	entries: Loadable<ITimeEntryRow[]> = loading([]);
	links: Loadable<ILinkedIssueGroup[]> = loading([]);

	/** The statuses the task can move to; read for those who may edit it. */
	statuses: ITaskStatus[] = [];
	savingStatus = false;

	readonly canEdit: boolean;

	private taskId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly http: HttpClient,
		private readonly dialogService: NbDialogService,
		private readonly tasksService: TasksService,
		private readonly timesheetService: TimesheetService,
		private readonly statisticsService: TimesheetStatisticsService,
		private readonly timeZoneService: TimeZoneService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
		this.canEdit = this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT);
	}

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, and the page follows the header's
		// organization: either changing reloads.
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				this.taskId = id;
				this.organization = organization;
				void this.load();
			});
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.show());
	}

	/** Loads (or reloads, after an error) the task the URL names. */
	async load(): Promise<void> {
		const id = this.taskId;
		const organizationId = this.organization?.id;
		if (!id || !organizationId) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous task (or organization) stays on screen — nor reachable by the star.
		this.task = null;
		this.state = 'loading';
		try {
			const task = await this.tasksService.getById(id, TASK_PAGE_RELATIONS);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!task?.id || (task.organizationId && task.organizationId !== organizationId)) {
				throw { status: 404 };
			}
			this.task = task;
			this.show();
			this.state = 'ready';
			this.loadPanels(task, sequence);
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.task = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	/** Reads the task again in place, after a change: the page stays on screen while it does. */
	private async refresh(): Promise<void> {
		const sequence = ++this.loadSequence;
		try {
			const task = await this.tasksService.getById(this.taskId, TASK_PAGE_RELATIONS);
			if (sequence !== this.loadSequence || !task?.id) return;
			this.task = task;
			this.show();
			this.loadPanels(task, sequence);
		} catch {
			// The page keeps what it showed.
		}
	}

	/* ── Actions ── */

	/**
	 * Moves the task to another status — the status alone, as the project board does, so nothing else read
	 * with the page can undo a newer edit — then reads the task again.
	 */
	async changeStatus(statusId: string): Promise<void> {
		const status = this.statuses.find((item) => item.id === statusId);
		if (!status || !this.task || this.savingStatus || status.id === this.task.taskStatusId) return;
		this.savingStatus = true;
		try {
			await firstValueFrom(
				this.http.put<ITask>(`${API_PREFIX}/tasks/${this.task.id}/status`, {
					status: status.value || status.name,
					taskStatusId: status.id,
					...this.scope()
				})
			);
			await this.refresh();
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.savingStatus = false;
		}
	}

	/** Opens the task dialog the task list edits with, then saves what it answers and reads the task again. */
	async edit(): Promise<void> {
		if (!this.task || !this.canEdit) return;
		const dialog = this.dialogService.open(AddTaskDialogComponent, { context: { selectedTask: this.task } });
		const data: any = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!data) return;
		const { estimateDays, estimateHours, estimateMinutes } = data;
		const estimate =
			(Number(estimateDays) || 0) * 24 * 60 * 60 + (Number(estimateHours) || 0) * 60 * 60 + (Number(estimateMinutes) || 0) * 60;
		try {
			await firstValueFrom(
				this.tasksService.editTask({
					...data,
					estimate: estimate || null,
					...this.scope(),
					id: this.task.id
				})
			);
			await this.refresh();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.task) return;
		const path = this.router.serializeUrl(this.router.createUrlTree(['/pages/tasks/view', this.task.id]));
		const { origin, pathname, hash } = window.location;
		// The app routes by the hash (`/#/pages/…`); the link keeps to it.
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('TASK_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/* ── View helpers ── */

	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	projectLink(id: string): string[] {
		return ['/pages/organization/projects/view', id];
	}

	/** The parent task as the breadcrumb names it: "#12 Parent title". */
	get parentLabel(): string | null {
		const parent = this.task?.parent as any;
		if (!parent?.id) return null;
		return [parent.taskNumber ? this.hashNumberPipe.transform(parent.taskNumber) : '', parent.title]
			.filter(Boolean)
			.join(' ');
	}

	get taskKey(): string {
		const number = (this.task as any)?.taskNumber;
		return number ? this.hashNumberPipe.transform(number) : '';
	}

	/** The total of the hours chart, so an empty fortnight says so instead of drawing flat bars. */
	get hoursTotal(): number {
		return (this.hours.value || []).reduce((sum, day) => sum + day.tracked + day.manual, 0);
	}

	formatHours = (hours: number): string => formatDuration((Number(hours) || 0) * 3600);

	/* ── Reads ── */

	/** Every panel reads on its own; a failure (most often a 403) blanks only its panel. */
	private loadPanels(task: ITask, sequence: number): void {
		void this.loadTime(task, sequence);
		void this.loadHours(task, sequence);
		void this.loadEntries(task, sequence);
		void this.loadLinks(task, sequence);
		if (this.canEdit) void this.loadStatuses(task, sequence);
	}

	/**
	 * The time worked on the task, all time, against its estimate, and who worked most on it: each employee's
	 * time on it, summed by the server. The project lets a manager of it see its members' time.
	 */
	private async loadTime(task: ITask, sequence: number): Promise<void> {
		this.tracking = loading(this.tracking.value);
		const filters = { ...this.scope(), taskIds: [task.id], ...(task.projectId ? { projectIds: [task.projectId] } : {}) };
		const [totals, people] = await Promise.allSettled([
			this.statisticsService.getTasksStatistics(filters),
			this.statisticsService.getTaskEmployees(filters)
		]);
		if (sequence !== this.loadSequence) return;
		if (totals.status === 'fulfilled') {
			const row = (totals.value || []).find((item) => item.id === task.id);
			this.tracking = loaded(timeTrackingOf(Number(row?.duration) || 0, task.estimate));
		} else {
			this.tracking = failed(null);
		}
		this.workers = people.status === 'fulfilled' ? taskWorkersOf(people.value || [], 5) : [];
	}

	/** The hours worked on the task each day of the last fortnight, tracked and manual. */
	private async loadHours(task: ITask, sequence: number): Promise<void> {
		this.hours = loading([]);
		try {
			const rows = await this.timesheetService.getDailyReportChart({
				...this.range(HOURS_DAYS),
				taskIds: [task.id]
			});
			if (sequence !== this.loadSequence) return;
			this.hours = loaded(hoursDaysOf(rows));
		} catch {
			if (sequence === this.loadSequence) this.hours = failed([]);
		}
	}

	/** The newest time entries of the last month, with their activity; the server keeps to what the viewer may see. */
	private async loadEntries(task: ITask, sequence: number): Promise<void> {
		this.entries = loading([]);
		try {
			const logs = await this.timesheetService.getTimeLogs({ ...this.range(ENTRIES_DAYS), taskIds: [task.id] }, [
				'employee',
				'employee.user',
				'timeSlots'
			]);
			if (sequence !== this.loadSequence) return;
			this.entries = loaded(timeEntriesOf(logs || []));
		} catch {
			if (sequence === this.loadSequence) this.entries = failed([]);
		}
	}

	/** The links the task starts and the links that end at it, read side by side. */
	private async loadLinks(task: ITask, sequence: number): Promise<void> {
		this.links = loading([]);
		const read = (where: Record<string, string>, relations: string[]) =>
			firstValueFrom(
				this.http.get<IPagination<ITaskLinkedIssue>>(`${API_PREFIX}/task-linked-issue`, {
					params: toParams({ where: { ...this.scope(), ...where }, relations })
				})
			);
		const [outgoing, incoming] = await Promise.allSettled([
			read({ taskFromId: task.id }, ['taskTo', 'taskTo.taskStatus']),
			read({ taskToId: task.id }, ['taskFrom', 'taskFrom.taskStatus'])
		]);
		if (sequence !== this.loadSequence) return;
		if (outgoing.status === 'rejected' && incoming.status === 'rejected') {
			this.links = failed([]);
			return;
		}
		this.links = loaded(
			linkedIssueGroupsOf(
				outgoing.status === 'fulfilled' ? outgoing.value?.items || [] : [],
				incoming.status === 'fulfilled' ? incoming.value?.items || [] : [],
				task.id,
				(value) => this.hashNumberPipe.transform(value)
			)
		);
	}

	/** The statuses the task's project takes, in their order, as the project board's columns. */
	private async loadStatuses(task: ITask, sequence: number): Promise<void> {
		try {
			const read = async (where: Record<string, string>) =>
				(
					await firstValueFrom(
						this.http.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
							params: toParams(where)
						})
					)
				)?.items || [];
			const statuses = await scopedTaskStatusesOf(read, { ...this.scope(), projectId: task.projectId });
			if (sequence !== this.loadSequence) return;
			this.statuses = [...statuses].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
		} catch {
			// The status shows without its menu.
		}
	}

	private scope() {
		return { organizationId: this.organization?.id, tenantId: this.organization?.tenantId };
	}

	/** The last `days` days, to the end of today, as the time endpoints read a window. */
	private range(days: number) {
		const timeZone = this.timeZoneService.currentTimeZone;
		const format = (date: moment.Moment) => toUtcOffset(date, timeZone).format('YYYY-MM-DD HH:mm:ss');
		return {
			...this.scope(),
			startDate: format(moment().subtract(days - 1, 'days').startOf('day')),
			endDate: format(moment().endOf('day')),
			timeZone
		};
	}

	/** Works out everything the page shows from the task. */
	private show(): void {
		const task = this.task;
		if (!task) {
			return;
		}
		this.status = taskStatusOf(task);
		this.subtasks = this.subtasksOf(task);
		const done = this.subtasks.filter((row) => row.done).length;
		const total = this.subtasks.length;
		this.subtaskCount = total ? { done, total, percent: (done / total) * 100 } : null;
		const sections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this.hashNumberPipe.transform(value)
		});
		// The description is the work, beside the subtasks; the details and the stamps are the facts. The
		// status is the header's button, as in Jira, so the details leave it out.
		this.mainSections = sections.filter((section) => section.variant === 'plain');
		this.metaSections = sections.filter((section) => section.variant === 'meta');
		this.detailsSections = sections
			.filter((section) => section.variant !== 'plain' && section.variant !== 'meta')
			.map((section) => ({
				...section,
				fields: section.fields.filter((field) => field.label !== 'TASKS_PAGE.TASKS_STATUS')
			}));
	}

	/** Open subtasks first, then the finished ones, each by number. */
	private subtasksOf(task: ITask): ISubtaskRow[] {
		return (task.children || [])
			.map((child) => ({ child, done: isTaskFinished(child) }))
			.sort((a, b) => Number(a.done) - Number(b.done) || (Number(a.child.number) || 0) - (Number(b.child.number) || 0))
			.map(({ child, done }) => {
				// `taskNumber` is a server-side virtual column (prefix + number), absent from ITask.
				const number = (child as any).taskNumber;
				return {
					id: child.id,
					key: number ? this.hashNumberPipe.transform(number) : '',
					title: child.title,
					status: taskStatusOf(child),
					done
				};
			});
	}
}
