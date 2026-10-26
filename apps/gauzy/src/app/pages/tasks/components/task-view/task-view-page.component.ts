import { ChangeDetectionStrategy, Component, HostBinding, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { BaseEntityEnum, IOrganization, ITask } from '@gauzy/contracts';
import { Store, TasksService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import {
	dueInWords,
	ITaskProgress,
	ITaskWorker,
	projectWorkedTimeOf,
	taskProgressOf,
	taskWorkersOf
} from '../../../projects/components/project-view/project-view.utils';
import {
	buildTaskViewSections,
	isTaskFinished,
	taskPriorityOf,
	taskSizeOf,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from './task-view-sections';

/** The page's tabs, as on the project page; the open one is in the URL (`?tab=`). */
export type TaskViewTab = 'overview' | 'activity';

const TABS: TaskViewTab[] = ['overview', 'activity'];

/** The relations the page reads: the View's, and the subtasks with their status. */
export const TASK_PAGE_RELATIONS: string[] = [...TASK_VIEW_RELATIONS, 'children', 'children.taskStatus'];

/** The headline's due date: the date, and how far off it is. */
export interface ITaskDue {
	date: string;
	words: { key: string; count?: number };
	overdue: boolean;
}

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
 * Laid out as the project page is. Overview: the task's header and four figures — time worked against the
 * estimate, the due date, the priority and the subtasks done — then its subtasks beside its time (who worked
 * most on it), then the sections the drawer shows, from the same builder. Activity: what changed on it.
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
	/** The list a task belongs to, for the page's back button. */
	readonly backLink = '/pages/tasks/dashboard';
	readonly tabs: { id: TaskViewTab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'PROJECT_VIEW.TABS.OVERVIEW', icon: 'home-outline' },
		{ id: 'activity', label: 'PROJECT_VIEW.TABS.ACTIVITY', icon: 'list-outline' }
	];
	tab: TaskViewTab = 'overview';

	task: ITask = null;
	status: IRecordViewStatus = null;
	sections: IRecordViewSection[] = [];
	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;

	/** The headline's figures, worked out with the task. */
	priority: IRecordViewStatus | null = null;
	size: IRecordViewStatus | null = null;
	due: ITaskDue | null = null;
	subtasks: ISubtaskRow[] = [];
	subtaskCount: ISubtaskCount | null = null;

	/** The time reads are under way. */
	timeLoading = false;
	/** The time worked on the task against its estimate, once read; `null` until then, or with neither. */
	progress: ITaskProgress | null = null;
	/** The people who worked most on the task, once read. */
	workers: ITaskWorker[] = [];

	private taskId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly tasksService: TasksService,
		private readonly statisticsService: TimesheetStatisticsService,
		private readonly store: Store
	) {
		super(translateService);
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
		// The open tab follows the URL, so a tab can be bookmarked, shared and reached with Back.
		this.route.queryParamMap
			.pipe(
				map((params) => params.get('tab') as TaskViewTab),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((tab) => (this.tab = TABS.includes(tab) ? tab : 'overview'));
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.show());
	}

	/** Opens a tab, keeping it in the URL without a new history entry per click. */
	selectTab(tab: TaskViewTab): void {
		this.tab = tab;
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { tab: tab === 'overview' ? null : tab },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
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
		this.progress = null;
		this.workers = [];
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
			void this.loadTime(task, sequence);
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.task = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	subtaskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
	}

	/** The time worked against the estimate and who worked most, read together; each lands on its own. */
	private async loadTime(task: ITask, sequence: number): Promise<void> {
		this.timeLoading = true;
		await Promise.all([this.loadProgress(task, sequence), this.loadWorkers(task, sequence)]);
		if (sequence === this.loadSequence) this.timeLoading = false;
	}

	/**
	 * The time worked on the task, all time, against its estimate — or, without one, against its project's
	 * tracked time, as the project page's task drawer reads it. A failed read shows no progress.
	 */
	private async loadProgress(task: ITask, sequence: number): Promise<void> {
		try {
			const rows = await this.statisticsService.getTasksStatistics({
				...this.scope(),
				...(task.projectId ? { projectIds: [task.projectId] } : { taskIds: [task.id] })
			});
			if (sequence !== this.loadSequence) return;
			const seconds = (rows || []).map((row) => Number(row.duration) || 0);
			const row = (rows || []).find((item) => item.id === task.id);
			this.progress = taskProgressOf(Number(row?.duration) || 0, task.estimate, projectWorkedTimeOf(seconds));
		} catch {
			// The page stays without progress.
		}
	}

	/**
	 * Who worked most on the task, all time: each employee's time on it, summed by the server. The project
	 * lets a manager of it see its members' time. A failed read lists no one.
	 */
	private async loadWorkers(task: ITask, sequence: number): Promise<void> {
		try {
			const rows = await this.statisticsService.getTaskEmployees({
				...this.scope(),
				taskIds: [task.id],
				...(task.projectId ? { projectIds: [task.projectId] } : {})
			});
			if (sequence !== this.loadSequence) return;
			this.workers = taskWorkersOf(rows || [], 5);
		} catch {
			// The page stays without its people.
		}
	}

	private scope() {
		return { organizationId: this.organization?.id, tenantId: this.organization?.tenantId };
	}

	/** Works out everything the page shows from the task. */
	private show(): void {
		const task = this.task;
		if (!task) {
			return;
		}
		this.status = taskStatusOf(task);
		this.priority = taskPriorityOf(task);
		this.size = taskSizeOf(task);
		this.due = this.dueOf(task);
		this.subtasks = this.subtasksOf(task);
		const done = this.subtasks.filter((row) => row.done).length;
		const total = this.subtasks.length;
		this.subtaskCount = total ? { done, total, percent: (done / total) * 100 } : null;
		this.sections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this.hashNumberPipe.transform(value)
		});
	}

	/** The due date, and how far off it is; a finished task's due date is no longer a deadline. */
	private dueOf(task: ITask): ITaskDue | null {
		if (!task.dueDate) {
			return null;
		}
		const finished = isTaskFinished(task);
		const daysLeft = moment(task.dueDate).startOf('day').diff(moment().startOf('day'), 'days');
		return {
			date: moment(task.dueDate).format('ll'),
			words: dueInWords(daysLeft, finished),
			overdue: !finished && daysLeft < 0
		};
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
