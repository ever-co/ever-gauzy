import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, inject, Input, Output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from '@gauzy/ui-core/core';
import { TaskViewsAvailabilityService } from '../../services/task-views-availability.service';
import { GoToResult, TaskReferenceNavigatorService } from '../../services/task-reference-navigator.service';

/**
 * "Go to task": a field taking a reference (`API-42`), a task id or a task link; Enter looks it up and opens the
 * task. A reference that names nothing the reader may see, or names tasks of several projects, is said under the
 * field; a task found by a former reference opens with a note of its reference today.
 */
@Component({
	selector: 'ngx-task-views-go-to-box',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbIconModule, NbInputModule, TranslatePipe],
	template: `
		<form class="go-to" role="search" (ngSubmit)="submit()" data-test="go-to-task">
			<input
				#field
				nbInput
				[fieldSize]="size"
				class="go-to-field"
				name="reference"
				autocomplete="off"
				spellcheck="false"
				[attr.aria-label]="'TASK_VIEWS.GOTO.TITLE' | translate"
				[placeholder]="'TASK_VIEWS.GOTO.PLACEHOLDER' | translate"
				[ngModel]="text()"
				(ngModelChange)="text.set($event); message.set(null)"
				[disabled]="busy()"
			/>
			<button nbButton ghost [size]="size" type="submit" [disabled]="busy() || !text().trim()" [attr.aria-label]="'TASK_VIEWS.GOTO.OPEN' | translate">
				<nb-icon icon="arrow-forward-outline"></nb-icon>
			</button>
		</form>
		@if (message(); as shown) {
			<p class="go-to-message" role="status" data-test="go-to-message">{{ shown.key | translate: shown.params }}</p>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.go-to {
				display: flex;
				align-items: center;
				gap: 0.25rem;
			}
			.go-to-field {
				min-width: 12rem;
				flex: 1;
			}
			.go-to-message {
				margin: 0.25rem 0 0;
				font-size: 0.8125rem;
				color: var(--text-hint-color, #8f9bb3);
			}
		`
	]
})
export class GoToTaskBoxComponent {
	private readonly navigator = inject(TaskReferenceNavigatorService);
	private readonly availability = inject(TaskViewsAvailabilityService);
	private readonly toastr = inject(ToastrService);

	@Input() size: 'tiny' | 'small' | 'medium' = 'small';
	/** Emits once the task opened (the dialog closes then). */
	@Output() readonly opened = new EventEmitter<void>();

	@ViewChild('field') private field?: ElementRef<HTMLInputElement>;

	protected readonly text = signal('');
	protected readonly busy = signal(false);
	protected readonly message = signal<{ key: string; params?: Record<string, unknown> } | null>(null);

	focus(): void {
		this.field?.nativeElement.focus();
	}

	async submit(): Promise<void> {
		const text = this.text().trim();
		if (!text || this.busy()) return;
		this.busy.set(true);
		this.message.set(null);
		let result: GoToResult;
		try {
			const scope = await firstValueFrom(this.availability.scope$);
			result = await this.navigator.goTo(text, scope);
		} finally {
			this.busy.set(false);
		}
		if (!result.opened) {
			this.message.set({ key: result.messageKey, params: result.params });
			return;
		}
		if (result.outcome?.kind === 'moved') {
			this.toastr.info('TASK_VIEWS.GOTO.MOVED', 'TASK_VIEWS.GOTO.TITLE', {
				translationParams: { reference: result.outcome.reference, current: result.outcome.current }
			});
		}
		this.text.set('');
		this.opened.emit();
	}
}
