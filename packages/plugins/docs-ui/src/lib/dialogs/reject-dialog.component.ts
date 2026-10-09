import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * Review rejection dialog with an explicitly OPTIONAL reason (`01-ux-spec.md`
 * §11 — rejection never requires a reason; the same `reason` field is sent for
 * single and bulk rejection). Closes with `{ reason?: string }` on confirm,
 * `null` on cancel.
 */
@Component({
	selector: 'gz-docs-reject-dialog',
	template: `
		<nb-card class="docs-dialog docs-reject-dialog">
			<nb-card-header>{{ 'DOCS.REVIEW.REJECT' | translate }}</nb-card-header>
			<nb-card-body>
				<label class="label" for="docs-reject-reason">{{ 'DOCS.REVIEW.REJECT_NOTE_LABEL' | translate }}</label>
				<textarea
					id="docs-reject-reason"
					nbInput
					fullWidth
					rows="3"
					maxlength="1000"
					[(ngModel)]="reason"
				></textarea>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="danger" (click)="confirm()">{{ 'DOCS.REVIEW.REJECT' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-reject-dialog {
				min-width: 22rem;
				max-width: 30rem;
			}
			.label {
				display: block;
				margin-bottom: 0.25rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	],
	standalone: false
})
export class RejectDialogComponent extends TranslationBaseComponent {
	public reason = '';

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<RejectDialogComponent>
	) {
		super(translateService);
	}

	confirm(): void {
		const reason = this.reason.trim();
		this.dialogRef.close({ reason: reason || undefined });
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
