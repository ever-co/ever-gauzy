import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { ID } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { taskReferenceOf } from '../../models/task-reference';
import { TaskViewsApiService } from '../../services/task-views-api.service';
import { TaskViewsAvailabilityService } from '../../services/task-views-availability.service';

/** The route parameter the task's own page carries the task id in (`/pages/tasks/view/:id`). */
export const TASK_VIEW_ID_PARAM = 'id';

/**
 * The task's reference (`API-42`, the project key and the number) on the task's own page (the `task-view-actions`
 * slot), with a click that copies it: what chat messages and documents name the task by. Shown only where the API
 * serves the task views (its references resolve there).
 */
@Component({
	selector: 'ngx-task-views-reference-chip',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		@if (reference(); as shown) {
			<button
				nbButton
				ghost
				size="tiny"
				status="basic"
				type="button"
				class="reference-chip"
				data-test="task-reference-chip"
				[nbTooltip]="'TASK_VIEWS.REFERENCE.COPY' | translate: { reference: shown }"
				nbTooltipPlacement="top"
				[attr.aria-label]="'TASK_VIEWS.REFERENCE.COPY' | translate: { reference: shown }"
				(click)="copy(shown)"
			>
				<nb-icon icon="hash-outline"></nb-icon>
				<span class="reference-text">{{ shown }}</span>
			</button>
		}
	`,
	styles: [
		`
			.reference-chip {
				font-family: var(--font-family-monospace, monospace);
				letter-spacing: 0.02em;
			}
			.reference-text {
				margin-left: 0.125rem;
			}
		`
	]
})
export class TaskReferenceChipComponent {
	private readonly api = inject(TaskViewsApiService);
	private readonly availability = inject(TaskViewsAvailabilityService);
	private readonly toastr = inject(ToastrService);

	protected readonly reference = toSignal(
		combineLatest([
			this.availability.available$,
			this.availability.scope$,
			inject(ActivatedRoute).paramMap.pipe(
				map((params) => params.get(TASK_VIEW_ID_PARAM)),
				distinctUntilChanged()
			)
		]).pipe(
			switchMap(([available, scope, taskId]) =>
				available && scope && taskId
					? this.api.getTask(taskId as ID, scope).pipe(
							map((task) => taskReferenceOf(task)),
							catchError(() => of(null))
						)
					: of(null)
			)
		),
		{ initialValue: null }
	);

	protected async copy(reference: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(reference);
			this.toastr.success('TASK_VIEWS.REFERENCE.COPIED', { reference });
		} catch {
			// No clipboard (an insecure origin, a denied permission): the reference stays readable on the button.
		}
	}
}
