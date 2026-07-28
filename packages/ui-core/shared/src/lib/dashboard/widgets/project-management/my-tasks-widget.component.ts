import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ITask, TaskStatusEnum } from '@gauzy/contracts';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';
import { BaseProjectManagementWidgetComponent } from './base-project-management-widget.component';

/**
 * The task list of the Project Management dashboard's "Today" panel.
 *
 * Same rows as the legacy panel: a completion dot, the raw task status and the
 * title, ordered by due date. Two aspects of the panel's behaviour are
 * deliberately NOT carried over:
 *
 * - the infinite scroll, because a canvas card samples one page instead (the
 *   widget says how many of the total it is showing rather than pretending the
 *   page is everything);
 * - the "Add Todo" button, because it opens `MyTaskDialogComponent`, which lives
 *   in the application's pages and cannot be imported from `@gauzy/ui-core`. A
 *   button that silently did nothing would be worse than no button.
 */
@Component({
	selector: 'ga-pm-my-tasks-widget',
	templateUrl: './my-tasks-widget.component.html',
	styleUrls: ['./project-management-list-widget.shared.scss', './my-tasks-widget.component.scss'],
	standalone: true,
	imports: [TranslateModule, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTasksWidgetComponent extends BaseProjectManagementWidgetComponent {
	/** The fetched page of tasks, in server order (due date ascending). */
	protected readonly tasks = computed<ITask[]>(() => this.snapshot()?.tasks ?? []);

	/** Total tasks matching the scope, of which {@link tasks} is a sample. */
	protected readonly total = computed<number>(() => this.snapshot()?.total ?? 0);

	/** True when the scope holds more tasks than the sampled page shows. */
	protected readonly hasMore = computed<boolean>(() => this.total() > this.tasks().length);

	/**
	 * Whether a task is finished, i.e. whether its dot is filled in.
	 *
	 * @param task - The row being rendered.
	 * @returns True when the task is completed.
	 */
	protected isCompleted(task: ITask): boolean {
		return task?.status === TaskStatusEnum.COMPLETED;
	}
}
