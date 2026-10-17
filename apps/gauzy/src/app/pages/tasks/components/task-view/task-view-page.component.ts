import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { BaseEntityEnum, IOrganization, ITask } from '@gauzy/contracts';
import { Store, TasksService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	HashNumberPipe,
	IRecordViewSection,
	IRecordViewStatus,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import { buildTaskViewSections, taskStatusOf, TASK_VIEW_RELATIONS } from './task-view-sections';

/**
 * A task on its own full-width page, `/pages/tasks/view/:id` (handover §4.P): what a task favorite in the
 * sidebar opens, and where the task drawer's "expand to full width" icon leads. The URL is the task's —
 * bookmark it, share it, reload it. It renders the very sections the drawer shows, from the same builder.
 *
 * The page belongs to the organization selected in the header, like the task lists: a task of another
 * organization reads "not found" (its favorite star would otherwise file it under the wrong organization),
 * and switching the organization reloads the page, discarding any load still in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-view-page',
	templateUrl: './task-view-page.component.html',
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TaskViewPageComponent extends TranslationBaseComponent implements OnInit {
	readonly favoriteEntity = BaseEntityEnum.Task;
	/** The list a task belongs to, for the page's back button. */
	readonly backLink = '/pages/tasks/dashboard';

	task: ITask = null;
	status: IRecordViewStatus = null;
	sections: IRecordViewSection[] = [];
	state: RecordViewPageState = 'loading';

	private taskId: string = null;
	private organizationId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly tasksService: TasksService,
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
		const organizationId$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			map((organization: IOrganization) => organization.id),
			distinctUntilChanged()
		);
		combineLatest([id$, organizationId$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organizationId]) => {
				this.taskId = id;
				this.organizationId = organizationId;
				void this.load();
			});
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildSections());
	}

	/** Loads (or reloads, after an error) the task the URL names. */
	async load(): Promise<void> {
		const id = this.taskId;
		const organizationId = this.organizationId;
		if (!id || !organizationId) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous task (or organization) stays on screen — nor reachable by the star.
		this.task = null;
		this.state = 'loading';
		try {
			const task = await this.tasksService.getById(id, TASK_VIEW_RELATIONS);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!task?.id || (task.organizationId && task.organizationId !== organizationId)) {
				throw { status: 404 };
			}
			this.task = task;
			this.buildSections();
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.task = null;
			this.state = recordViewPageStateOf(error);
		}
	}

	private buildSections(): void {
		if (!this.task) {
			return;
		}
		this.status = taskStatusOf(this.task);
		this.sections = buildTaskViewSections(this.task, {
			translate: (key) => this.getTranslation(key),
			hash: (value) => this.hashNumberPipe.transform(value)
		});
	}
}
