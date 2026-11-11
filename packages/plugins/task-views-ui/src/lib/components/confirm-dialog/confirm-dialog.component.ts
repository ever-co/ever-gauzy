import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

/** A question with Cancel and a confirming button (delete a view, delete tasks); answers `true` when confirmed. */
@Component({
	selector: 'ngx-task-views-confirm-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, TranslatePipe],
	template: `
		<nb-card class="confirm-dialog" data-test="confirm-dialog">
			<nb-card-body>
				<p class="message">{{ messageKey | translate: params }}</p>
			</nb-card-body>
			<nb-card-footer class="actions">
				<button nbButton status="basic" type="button" (click)="close(false)">
					{{ 'TASK_VIEWS.DIALOG.CANCEL' | translate }}
				</button>
				<button
					nbButton
					[status]="danger ? 'danger' : 'primary'"
					type="button"
					data-test="confirm"
					(click)="close(true)"
				>
					{{ confirmKey | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.confirm-dialog {
				width: min(26rem, 92vw);
			}
			.message {
				margin: 0;
			}
			.actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class ConfirmDialogComponent {
	private readonly ref = inject(NbDialogRef) as NbDialogRef<ConfirmDialogComponent>;

	@Input() messageKey = '';
	@Input() params: Record<string, unknown> = {};
	@Input() confirmKey = 'TASK_VIEWS.DIALOG.CONFIRM';
	@Input() danger = true;

	protected close(confirmed: boolean): void {
		this.ref.close(confirmed);
	}
}
