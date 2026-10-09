import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * Manual review request dialog (`01-ux-spec.md` §11 / backend `RequestReviewDTO`).
 * The reason is OPTIONAL — exactly like rejection — and is what makes the review
 * queue reachable when AI is disabled: without it the only path into `PENDING`
 * is an AI-driven `reviewReason`. Closes with `{ reason?: string }` on confirm,
 * `null` on cancel.
 */
@Component({
	selector: 'gz-docs-request-review-dialog',
	template: `
		<nb-card class="docs-dialog docs-request-review-dialog">
			<nb-card-header>{{ 'DOCS.REVIEW.REQUEST' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="docs-request-review-body">{{ 'DOCS.REVIEW.REQUEST_BODY' | translate }}</p>
				<label class="label" for="docs-request-review-reason">
					{{ 'DOCS.REVIEW.REQUEST_REASON_LABEL' | translate }}
				</label>
				<textarea
					id="docs-request-review-reason"
					nbInput
					fullWidth
					rows="3"
					maxlength="1000"
					[(ngModel)]="reason"
				></textarea>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="warning" (click)="confirm()">{{ 'DOCS.REVIEW.REQUEST' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-request-review-dialog {
				min-width: 22rem;
				max-width: 30rem;
			}
			.docs-request-review-body {
				margin-bottom: 0.75rem;
				color: var(--text-hint-color);
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
export class RequestReviewDialogComponent extends TranslationBaseComponent {
	public reason = '';

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<RequestReviewDialogComponent>
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
