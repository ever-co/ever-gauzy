import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { BaseEntityEnum, ITask } from '@gauzy/contracts';
import { TasksService } from '@gauzy/ui-core/core';
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
	private readonly hashNumberPipe = new HashNumberPipe();

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly tasksService: TasksService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, so the id stream is what loads.
		this.route.paramMap
			.pipe(
				map((params) => params.get('id')),
				filter((id): id is string => !!id),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((id) => {
				this.taskId = id;
				void this.load();
			});
		// The estimate is spelled out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => this.buildSections());
	}

	/** Loads (or reloads, after an error) the task the URL names. */
	async load(): Promise<void> {
		const id = this.taskId;
		if (!id) {
			return;
		}
		this.state = 'loading';
		try {
			const task = await this.tasksService.getById(id, TASK_VIEW_RELATIONS);
			if (id !== this.taskId) {
				return; // a newer navigation owns the page
			}
			if (!task?.id) {
				throw { status: 404 };
			}
			this.task = task;
			this.buildSections();
			this.state = 'ready';
		} catch (error) {
			if (id !== this.taskId) {
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
