import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Tiny URL prompt used by the slash commands Video / Embed (spec 05 §6.4).
 * Closes with the trimmed URL, or `null` on cancel.
 */
@Component({
	selector: 'gz-docs-url-prompt-dialog',
	standalone: true,
	imports: [FormsModule, TranslateModule, NbButtonModule, NbCardModule, NbInputModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nb-card class="gz-url-dialog">
			<nb-card-header>{{ titleKey | translate }}</nb-card-header>
			<nb-card-body>
				<input
					nbInput
					fullWidth
					type="url"
					[placeholder]="'DOCS.EDITOR.URL_PROMPT.PLACEHOLDER' | translate"
					[(ngModel)]="url"
					(keydown.enter)="confirm()"
				/>
			</nb-card-body>
			<nb-card-footer class="gz-url-dialog-footer">
				<button nbButton ghost type="button" (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" [disabled]="!isValid" (click)="confirm()">
					{{ 'DOCS.EDITOR.URL_PROMPT.INSERT' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.gz-url-dialog {
				min-width: 24rem;
			}
			.gz-url-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class UrlPromptDialogComponent {
	@Input() titleKey = 'DOCS.EDITOR.URL_PROMPT.TITLE';

	private readonly dialogRef = inject(NbDialogRef<UrlPromptDialogComponent>);

	public url = '';

	get isValid(): boolean {
		const trimmed = this.url.trim();
		return /^https?:\/\/.+/i.test(trimmed);
	}

	confirm(): void {
		if (this.isValid) this.dialogRef.close(this.url.trim());
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
