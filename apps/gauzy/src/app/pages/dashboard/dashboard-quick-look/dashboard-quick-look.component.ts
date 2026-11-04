import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ID, IOrganization, IOrganizationProject, ITask } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	DashboardQuickLookRequest,
	DashboardQuickLookService,
	DateRangePickerBuilderService,
	Store,
	TasksService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { HashNumberPipe, IRecordViewSection, IRecordViewStatus } from '@gauzy/ui-core/shared';
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

	public viewedTask: ITask | null = null;
	public viewSections: IRecordViewSection[] = [];
	public viewStatus: IRecordViewStatus | null = null;
	public viewedProject: IProjectQuickLookCard | null = null;
	public selectedEmployeeId: ID | null = null;
	public rangeStart: string;
	public rangeEnd: string;

	private _organization: IOrganization;
	private _viewSequence = 0;

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
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
				tap(({ startDate, endDate }) => {
					this.rangeStart = new Date(startDate).toISOString();
					this.rangeEnd = new Date(endDate).toISOString();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		combineLatest([this._store.selectedOrganization$, this._store.selectedEmployee$])
			.pipe(
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this._organization = organization;
					this.selectedEmployeeId = employee?.id ?? null;
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

	public get organizationId(): ID | null {
		return this._organization?.id ?? null;
	}

	public get tenantId(): ID | null {
		return this._organization?.tenantId ?? null;
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
			if (sequence === this._viewSequence && this.viewedTask?.id === task.id && full) {
				this._showTask(full);
			}
		} catch {
			// The row's own data stays on screen.
		}
	}

	public closeTask(): void {
		this._viewSequence++;
		this.viewedTask = null;
	}

	public openProject(project: IOrganizationProject): void {
		this.closeTask();
		this.viewedProject = {
			id: project.id,
			name: project.name,
			imageUrl: project.imageUrl,
			initials: this._initials(project.name)
		};
	}

	public closeProject(): void {
		this.viewedProject = null;
	}

	public closeAll(): void {
		this.closeTask();
		this.closeProject();
	}

	private _showTask(task: ITask): void {
		this.viewStatus = taskStatusOf(task);
		this.viewSections = buildTaskViewSections(task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this._hashPipe.transform(value)
		});
		this.viewedTask = task;
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
