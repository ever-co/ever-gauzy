import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { IInboxOneTimeValue } from './inbox-settings.helpers';

/**
 * Shows values the API answers exactly once — secrets the server generated for a provider account (a webhook
 * credential), the webhook URL that carries one, a mailbox's relay secret. Nothing can ask for them again (losing one
 * means generating a new one), so the caller opens this with `closeOnEsc: false` and `closeOnBackdropClick: false`,
 * and the values live only as long as the dialog: never on the page, in a store or in a toast.
 */
@Component({
	selector: 'ngx-inbox-one-time-secret-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, NbIconModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="one-time-dialog">
			<nb-card-header>{{ 'INBOX.SETTINGS.ONE_TIME.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="warning">
					<nb-icon icon="alert-triangle-outline" status="warning"></nb-icon>
					<span>{{ 'INBOX.SETTINGS.ONE_TIME.WARNING' | translate }}</span>
				</p>
				@for (entry of values; track $index) {
					<div class="entry" [attr.data-test]="'one-time-' + $index">
						<span class="label">{{ entry.translate ? (entry.label | translate) : entry.label }}</span>
						<div class="value">
							<code>{{ entry.value }}</code>
							<button
								nbButton
								ghost
								size="small"
								type="button"
								[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
								(click)="copy(entry.value)"
							>
								<nb-icon icon="copy-outline"></nb-icon>
							</button>
						</div>
					</div>
				}
				@if (hint) {
					<p class="hint">{{ hint | translate }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton status="primary" type="button" data-test="one-time-ack" (click)="acknowledge()">
					{{ 'INBOX.SETTINGS.ONE_TIME.ACK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.dialog {
				width: 36rem;
				max-width: 92vw;
			}
			.warning {
				display: flex;
				gap: 0.5rem;
				align-items: flex-start;
				color: var(--text-warning-color, #ffaa00);
			}
			.entry {
				margin-top: 0.75rem;
			}
			.label {
				display: block;
				font-weight: 600;
				margin-bottom: 0.25rem;
			}
			.value {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.value code {
				flex: 1 1 auto;
				padding: 0.375rem 0.5rem;
				border: 1px solid var(--divider-color, #edf1f7);
				border-radius: 0.25rem;
				font-size: 0.8125rem;
				overflow-wrap: anywhere;
				user-select: all;
			}
			.hint {
				margin-top: 0.75rem;
				font-size: 0.8rem;
				opacity: 0.75;
			}
			.footer {
				display: flex;
				justify-content: flex-end;
			}
		`
	]
})
export class InboxOneTimeSecretDialogComponent {
	private readonly dialogRef = inject<NbDialogRef<InboxOneTimeSecretDialogComponent>>(NbDialogRef);
	private readonly toastr = inject(ToastrService);

	/** Set through the dialog's `context`. */
	values: IInboxOneTimeValue[] = [];
	/** An optional translation key with what to do with the values. */
	hint: string | null = null;

	async copy(value: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			this.toastr.success('INBOX.SETTINGS.TOAST.COPIED');
		} catch {
			// No clipboard permission: the value is still selectable on screen.
		}
	}

	/** The only way out: closing is the acknowledgement. */
	acknowledge(): void {
		this.dialogRef.close(true);
	}
}
