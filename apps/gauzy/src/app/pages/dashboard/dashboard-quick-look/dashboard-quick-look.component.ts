import { Component, OnInit, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IDateRangePicker, IOrganization, IOrganizationProject, ITask } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	DashboardQuickLookRequest,
	DashboardQuickLookService,
	DateRangePickerBuilderService,
	Store,
	TasksService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	getAdjustDateRangeFutureAllowed,
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus
} from '@gauzy/ui-core/shared';
import {
	buildTaskViewSections,
	taskStatusOf,
	TASK_VIEW_RELATIONS
} from '../../tasks/components/task-view/task-view-sections';
import { IProjectQuickLookCard } from '../../projects/components/project-quick-look/project-quick-look.component';

/**
 * The dashboard's task and project quick looks, for sections that cannot host the drawers
 * themselves (plugin-contributed ones such as Time Tracking): they ask through
 * {@link DashboardQuickLookService} and the drawers open here, as on the Tasks pages.
 */
@UntilDestroy()
@Component({
	selector: 'ga-dashboard-quick-look',
	templateUrl: './dashboard-quick-look.component.html',
	// Eager, not OnPush: the project quick look loads its own figures and writes them to plain
	// fields, which an OnPush host would leave unrendered until the next event inside it.
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class DashboardQuickLookComponent extends TranslationBaseComponent implements OnInit {
	private readonly _quickLookService = inject(DashboardQuickLookService);
	private readonly _tasksService = inject(TasksService);
	private readonly _store = inject(Store);
	private readonly _dateRangePickerBuilderService = inject(DateRangePickerBuilderService);
	private readonly _router = inject(Router);
	private readonly _hashPipe = new HashNumberPipe();

	protected readonly viewedTask = signal<ITask | null>(null);
	protected readonly viewSections = signal<IRecordViewSection[]>([]);
	protected readonly viewStatus = signal<IRecordViewStatus | null>(null);
	protected readonly viewedProject = signal<IProjectQuickLookCard | null>(null);
	protected readonly selectedEmployeeId = signal<ID | null>(null);
	protected readonly rangeStart = signal<string | null>(null);
	protected readonly rangeEnd = signal<string | null>(null);

	private readonly _organization = signal<IOrganization | null>(null);
	protected readonly organizationId = computed<ID | null>(() => this._organization()?.id ?? null);
	protected readonly tenantId = computed<ID | null>(() => this._organization()?.tenantId ?? null);
	protected readonly scopeEmployeeIds = computed<ID[] | null>(() =>
		this.selectedEmployeeId() ? [this.selectedEmployeeId()] : null
	);

	private _selectedDateRange: IDateRangePicker | null = null;
	private _viewSequence = 0;

	// No parameters: TranslationBaseComponent injects TranslateService itself. The explicit constructor
	// stays, because Angular refuses (NG2006) a component inheriting the undecorated base's constructor.
	constructor() {
		super();
	}

	ngOnInit(): void {
		this._quickLookService.requests$
			.pipe(
				tap((request: DashboardQuickLookRequest) =>
					request.kind === 'task' ? this.openTask(request.task) : this.openProject(request.project)
				),
				untilDestroyed(this)
			)
			.subscribe();
		this._dateRangePickerBuilderService.selectedDateRange$
			.pipe(
				filter((range) => !!range?.startDate && !!range?.endDate),
				tap((range: IDateRangePicker) => {
					this._selectedDateRange = range;
					// An open project drawer follows the new period.
					if (this.viewedProject()) {
						this._applyDateRange();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		combineLatest([this._store.selectedOrganization$, this._store.selectedEmployee$])
			.pipe(
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this._organization.set(organization);
					this.selectedEmployeeId.set(employee?.id ?? null);
				}),
				// A drawer opened for the previous selection would describe a task or project no longer listed.
				tap(() => this.closeAll()),
				untilDestroyed(this)
			)
			.subscribe();
		// The drawers belong to the section that opened them, not to the next tab
		// (query-only changes, such as the date picker's, keep them open).
		this._router.events
			.pipe(
				filter((event): event is NavigationEnd => event instanceof NavigationEnd),
				map((event: NavigationEnd) => event.urlAfterRedirects.split('?')[0]),
				distinctUntilChanged(),
				tap(() => this.closeAll()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens the task's quick look straight away from the row's data, then swaps in the full
	 * record (description, members, sprints…) once it has loaded.
	 */
	public async openTask(task: ITask): Promise<void> {
		this.closeProject();
		const sequence = ++this._viewSequence;
		this._showTask(task);
		try {
			const full = await this._tasksService.getById(task.id, TASK_VIEW_RELATIONS);
			if (sequence === this._viewSequence && this.viewedTask()?.id === task.id && full) {
				this._showTask(full);
			}
		} catch {
			// The row's own data stays on screen.
		}
	}

	public closeTask(): void {
		this._viewSequence++;
		this.viewedTask.set(null);
	}

	public openProject(project: IOrganizationProject): void {
		this.closeTask();
		this._applyDateRange();
		this.viewedProject.set({
			id: project.id,
			name: project.name,
			imageUrl: project.imageUrl,
			initials: this._initials(project.name)
		});
	}

	public closeProject(): void {
		this.viewedProject.set(null);
	}

	public closeAll(): void {
		this.closeTask();
		this.closeProject();
	}

	private _showTask(task: ITask): void {
		this.viewStatus.set(taskStatusOf(task));
		this.viewSections.set(
			buildTaskViewSections(task, {
				translate: (key) => this.getTranslation(key),
				hash: (value) => this._hashPipe.transform(value)
			})
		);
		this.viewedTask.set(task);
	}

	/**
	 * The project drawer counts the same period as the Time Tracking cards: when the range
	 * ends today it runs to the end of the day, so work logged after it was picked is included.
	 */
	private _applyDateRange(): void {
		if (!this._selectedDateRange) {
			return;
		}
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this._selectedDateRange);
		this.rangeStart.set(new Date(startDate).toISOString());
		this.rangeEnd.set(new Date(endDate).toISOString());
	}

	/** "Gauzy Web App" → "GW". */
	private _initials(name: string): string {
		const words = (name || '').trim().split(/\s+/).filter(Boolean);
		return words
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('');
	}
}
