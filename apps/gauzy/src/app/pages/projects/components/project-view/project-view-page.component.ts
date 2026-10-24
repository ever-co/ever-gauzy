import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { BaseEntityEnum, IOrganization, ITask } from '@gauzy/contracts';
import {
	CommentService,
	OrganizationProjectsService,
	Store,
	TasksService,
	TimesheetStatisticsService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import {
	buildTaskViewSections,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from '../../../tasks/components/task-view/task-view-sections';
import { IProjectQuickLookCard } from '../project-quick-look/project-quick-look.component';
import {
	initialsOf,
	ITaskProgress,
	ITaskWorker,
	projectWorkedTimeOf,
	taskProgressOf,
	taskWorkersOf
} from './project-view.utils';

/** The windows the page's figures can be read over — the same as the team and employee pages. */
export enum ProjectViewPeriod {
	THIS_WEEK = 'THIS_WEEK',
	THIS_MONTH = 'THIS_MONTH',
	LAST_30_DAYS = 'LAST_30_DAYS'
}

/** The page's tabs, in the manner of Jira's project pages; the open one is in the URL (`?tab=`). */
export type ProjectViewTab = 'overview' | 'board' | 'activity' | 'comments';

const TABS: ProjectViewTab[] = ['overview', 'board', 'activity', 'comments'];

/** Tabs whose figures read over the period, and so show the period switcher. */
const PERIOD_TABS = new Set<ProjectViewTab>(['overview']);

/**
 * A project on its own page, `/pages/organization/projects/view/:id`: what the project list's View
 * button opens. The URL is the project's — bookmark it, share it, reload it. Its body is the project
 * quick look the team and employee pages open in a drawer, laid out as a page, over everyone's time
 * on the project in the chosen period.
 *
 * The page belongs to the organization selected in the header, like the list: a project of another
 * organization reads "not found", and switching the organization reloads the page.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-view-page',
	templateUrl: './project-view-page.component.html',
	styleUrls: ['../../../employees/view-employee/view-employee.component.scss', './project-view-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ProjectViewPageComponent extends TranslationBaseComponent implements OnInit {
	/** The list a project belongs to, for the page's back button. */
	readonly backLink = '/pages/organization/projects';
	readonly periods: ProjectViewPeriod[] = Object.values(ProjectViewPeriod);
	readonly tabs: { id: ProjectViewTab; label: string; icon: string }[] = [
		{ id: 'overview', label: 'PROJECT_VIEW.TABS.OVERVIEW', icon: 'home-outline' },
		{ id: 'board', label: 'PROJECT_VIEW.TABS.BOARD', icon: 'grid-outline' },
		{ id: 'activity', label: 'PROJECT_VIEW.TABS.ACTIVITY', icon: 'list-outline' },
		{ id: 'comments', label: 'PROJECT_VIEW.TABS.COMMENTS', icon: 'message-square-outline' }
	];
	tab: ProjectViewTab = 'overview';

	state: RecordViewPageState = 'loading';
	/** The project as the quick look opens it: its name and logo; the quick look reads the rest. */
	card: IProjectQuickLookCard | null = null;
	organization: IOrganization | null = null;

	readonly period$ = new BehaviorSubject<ProjectViewPeriod>(ProjectViewPeriod.THIS_WEEK);
	get period(): ProjectViewPeriod {
		return this.period$.getValue();
	}
	set period(value: ProjectViewPeriod) {
		this.period$.next(value);
	}

	/**
	 * The Board loads when first opened, then stays mounted behind the other tabs: a move still saving
	 * when the user leaves it must still reach the Overview when it lands.
	 */
	boardOpened = false;

	/** The Comments load when first opened, then stay mounted, so a draft survives a look at another tab. */
	commentsOpened = false;
	/** The project's comments, replies included, on the Comments tab; read with the project, kept by the tab. */
	commentCount = 0;
	/** The Comments tab has counted the comments for this project: its count is newer than the first read. */
	private commentCountFromTab = false;

	/**
	 * The task open in the drawer — the quick look the task lists open — named by `?task=<id>`, so it can
	 * be shared and Back closes it. `viewedTaskId` holds the drawer open while the task loads.
	 */
	viewedTaskId: string | null = null;
	viewedTask: ITask | null = null;
	viewSections: IRecordViewSection[] = [];
	viewStatus: IRecordViewStatus | null = null;
	viewState: RecordViewPageState = 'loading';
	/** The open task's time worked against its estimate, once read; `null` until then, or with neither. */
	viewProgress: ITaskProgress | null = null;
	/** The people who worked most on the open task, once read. */
	viewWorkers: ITaskWorker[] = [];

	private projectId: string | null = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	private taskSequence = 0;
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		private readonly projectsService: OrganizationProjectsService,
		private readonly tasksService: TasksService,
		private readonly statisticsService: TimesheetStatisticsService,
		private readonly commentService: CommentService
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
				this.projectId = id;
				this.organization = organization;
				void this.load();
			});
		// The open tab follows the URL, so a tab can be bookmarked, shared and reached with Back.
		this.route.queryParamMap
			.pipe(
				map((params) => params.get('tab') as ProjectViewTab),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((tab) => this.openTab(TABS.includes(tab) ? tab : 'overview'));
		// The task drawer follows the URL too, and reloads with the organization.
		combineLatest([this.route.queryParamMap.pipe(map((params) => params.get('task'))), organization$])
			.pipe(
				distinctUntilChanged(([a, orgA], [b, orgB]) => a === b && orgA.id === orgB.id),
				untilDestroyed(this)
			)
			.subscribe(([taskId]) => void this.loadTask(taskId));
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.showTask(this.viewedTask));
	}

	/** Closes the task drawer, dropping `?task=` from the URL in place. */
	closeTask(): void {
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { task: null },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	/** Loads (or reloads, after an error) the task `?task=` names into the drawer; none closes it. */
	async loadTask(taskId: string | null = this.viewedTaskId): Promise<void> {
		const sequence = ++this.taskSequence;
		this.viewedTaskId = taskId;
		this.viewProgress = null;
		this.viewWorkers = [];
		this.showTask(null);
		if (!taskId) return;
		this.viewState = 'loading';
		try {
			const task = await this.tasksService.getById(taskId, TASK_VIEW_RELATIONS);
			if (sequence !== this.taskSequence) return; // another task (or none) owns the drawer
			if (!task?.id || (task.organizationId && task.organizationId !== this.organization?.id)) {
				throw { status: 404 };
			}
			this.showTask(task);
			this.viewState = 'ready';
			void this.loadTaskProgress(task, sequence);
			void this.loadTaskWorkers(task, sequence);
		} catch (error) {
			if (sequence !== this.taskSequence) return;
			this.viewState = recordViewPageStateOf(error);
		}
	}

	/**
	 * The time worked on the open task, all time, against its estimate — or, without one, against the
	 * project's most-worked task, so the project's tasks are read. A failed read shows no progress.
	 */
	private async loadTaskProgress(task: ITask, sequence: number): Promise<void> {
		const projectId = task.projectId || this.card?.id;
		try {
			const rows = await this.statisticsService.getTasksStatistics({
				organizationId: this.organization?.id,
				tenantId: this.organization?.tenantId,
				...(projectId ? { projectIds: [projectId] } : { taskIds: [task.id] })
			});
			if (sequence !== this.taskSequence) return;
			const seconds = (rows || []).map((row) => Number(row.duration) || 0);
			const row = (rows || []).find((item) => item.id === task.id);
			this.viewProgress = taskProgressOf(Number(row?.duration) || 0, task.estimate, projectWorkedTimeOf(seconds));
		} catch {
			// The drawer stays without progress.
		}
	}

	/**
	 * Who worked most on the open task, all time: each employee's time on it, summed by the server. The
	 * project lets a manager of it see its members' time. A failed read lists no one.
	 */
	private async loadTaskWorkers(task: ITask, sequence: number): Promise<void> {
		const projectId = task.projectId || this.card?.id;
		try {
			const rows = await this.statisticsService.getTaskEmployees({
				organizationId: this.organization?.id,
				tenantId: this.organization?.tenantId,
				taskIds: [task.id],
				...(projectId ? { projectIds: [projectId] } : {})
			});
			if (sequence !== this.taskSequence) return;
			this.viewWorkers = taskWorkersOf(rows || []);
		} catch {
			// The drawer stays without its people.
		}
	}

	private showTask(task: ITask | null): void {
		this.viewedTask = task;
		if (!task) return;
		this.viewStatus = taskStatusOf(task);
		this.viewSections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this.hashNumberPipe.transform(value)
		});
	}

	/** Opens a tab, keeping it in the URL without a new history entry per click. */
	selectTab(tab: ProjectViewTab): void {
		this.openTab(tab);
		void this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { tab: tab === 'overview' ? null : tab },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	private openTab(tab: ProjectViewTab): void {
		this.tab = tab;
		if (tab === 'board') this.boardOpened = true;
		if (tab === 'comments') this.commentsOpened = true;
	}

	/** Whether the open tab reads over the period, and so shows the period switcher. */
	get showsPeriod(): boolean {
		return PERIOD_TABS.has(this.tab);
	}

	/** Loads (or reloads, after an error) the project the URL names. */
	async load(): Promise<void> {
		const id = this.projectId;
		const organization = this.organization;
		if (!id || !organization) return;

		const sequence = ++this.loadSequence;
		// Nothing of the previous project (or organization) stays on screen.
		this.card = null;
		this.commentCount = 0;
		this.commentCountFromTab = false;
		this.state = 'loading';
		try {
			const project = await firstValueFrom(this.projectsService.getById(id, ['image']));
			if (sequence !== this.loadSequence) return; // a newer navigation or organization switch owns the page
			if (!project?.id || (project.organizationId && project.organizationId !== organization.id)) {
				throw { status: 404 };
			}
			this.card = {
				id: project.id,
				name: project.name,
				imageUrl: project.imageUrl || project.image?.fullUrl,
				initials: initialsOf(project.name)
			};
			this.state = 'ready';
			void this.loadCommentCount(project.id, sequence);
		} catch (error) {
			if (sequence !== this.loadSequence) return;
			this.card = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	/** The count the Comments tab reports each time it reads its list, after a post or a delete among others. */
	onCommentCount(count: number): void {
		this.commentCountFromTab = true;
		this.commentCount = count;
	}

	/**
	 * The Comments tab's count, before the tab is opened; a failed read leaves the tab without one. An answer that
	 * comes after the tab has counted for itself is older than the tab's count, and is dropped.
	 */
	private async loadCommentCount(projectId: string, sequence: number): Promise<void> {
		try {
			const count = await this.commentService.count(BaseEntityEnum.OrganizationProject, projectId, {
				organizationId: this.organization?.id,
				tenantId: this.organization?.tenantId
			});
			if (sequence === this.loadSequence && !this.commentCountFromTab) this.commentCount = count;
		} catch {
			// The tab shows no count.
		}
	}

	/** "Oct 12 – Oct 18, 2026": the window the page's figures cover. */
	get rangeLabel(): string {
		const { start, end } = this.periodRange();
		const sameYear = start.year() === end.year();
		return `${start.format(sameYear ? 'MMM D' : 'll')} – ${end.format('ll')}`;
	}

	/** The period as ISO dates — stable strings, so the quick look reloads only when the window moves. */
	get periodStartIso(): string {
		return this.periodRange().start.toISOString();
	}

	get periodEndIso(): string {
		return this.periodRange().end.toISOString();
	}

	private periodRange(): { start: moment.Moment; end: moment.Moment } {
		switch (this.period) {
			case ProjectViewPeriod.THIS_MONTH:
				return { start: moment().startOf('month'), end: moment().endOf('month') };
			case ProjectViewPeriod.LAST_30_DAYS:
				return { start: moment().subtract(29, 'days').startOf('day'), end: moment().endOf('day') };
			case ProjectViewPeriod.THIS_WEEK:
			default:
				return { start: moment().startOf('week'), end: moment().endOf('week') };
		}
	}
}
