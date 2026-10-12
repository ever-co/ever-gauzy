import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IDocumentInboundAddressSecret } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/**
 * One-time reveal of an inbound address's relay secret.
 *
 * The server stores only a SHA-256 of this value, so the plaintext exists exactly twice in its
 * whole life: in the `POST /inbound-addresses` (or `/rotate-secret`) response, and on this
 * screen. Nothing can ever recover it again — losing it means rotating, which invalidates the
 * secret the relay is currently using.
 *
 * That is why this is a modal with a single acknowledging button rather than a toast or an
 * inline panel, and why the caller opens it with `closeOnEsc: false` and
 * `closeOnBackdropClick: false`: a reflexive Esc must not be able to destroy a value that
 * cannot be asked for again.
 *
 * Standalone — it is opened from the (lazily route-loaded) inbound settings page, which lives
 * outside `DocsUiModule`'s injector.
 */
@Component({
	selector: 'gz-docs-inbound-secret-dialog',
	imports: [CommonModule, TranslateModule, NbButtonModule, NbCardModule, NbIconModule],
	template: `
		<nb-card class="docs-dialog docs-inbound-secret-dialog">
			<nb-card-header>{{ 'DOCS.INBOUND.SECRET_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<div class="docs-inbound-secret-warning">
					<nb-icon icon="alert-triangle-outline" status="warning"></nb-icon>
					<span>{{ 'DOCS.INBOUND.SECRET_WARNING' | translate }}</span>
				</div>

				<label class="label">{{ 'DOCS.INBOUND.ADDRESS' | translate }}</label>
				<div class="docs-inbound-secret-value">
					<code>{{ secret?.address }}</code>
					<button
						nbButton
						ghost
						size="small"
						[attr.aria-label]="'DOCS.INBOUND.COPY_ADDRESS' | translate"
						(click)="copy(secret?.address, 'DOCS.INBOUND.TOAST_ADDRESS_COPIED')"
					>
						<nb-icon icon="clipboard-outline"></nb-icon>
					</button>
				</div>

				<label class="label">{{ 'DOCS.INBOUND.SECRET_LABEL' | translate }}</label>
				<div class="docs-inbound-secret-value">
					<code class="docs-inbound-secret-plaintext">{{ secret?.webhookSecret }}</code>
					<button
						nbButton
						status="primary"
						size="small"
						[attr.aria-label]="'DOCS.INBOUND.COPY_SECRET' | translate"
						(click)="copy(secret?.webhookSecret, 'DOCS.INBOUND.TOAST_SECRET_COPIED')"
					>
						<nb-icon icon="clipboard-outline"></nb-icon>
						{{ 'DOCS.INBOUND.COPY_SECRET' | translate }}
					</button>
				</div>
				<p class="hint">{{ 'DOCS.INBOUND.SECRET_HINT' | translate }}</p>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton status="primary" (click)="acknowledge()">
					{{ 'DOCS.INBOUND.SECRET_ACK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-inbound-secret-dialog {
				width: 34rem;
				max-width: 92vw;
			}
			.docs-inbound-secret-warning {
				display: flex;
				align-items: flex-start;
				gap: 0.5rem;
				margin-bottom: 1rem;
				color: var(--text-warning-color);
			}
			.label {
				display: block;
				margin: 0.75rem 0 0.25rem;
				font-weight: 600;
			}
			.docs-inbound-secret-value {
				display: flex;
				align-items: center;
				gap: 0.5rem;

				code {
					flex: 1 1 auto;
					padding: 0.375rem 0.5rem;
					border: 1px solid var(--divider-color);
					border-radius: 0.25rem;
					font-size: 0.8125rem;
					overflow-wrap: anywhere;
				}
			}
			.docs-inbound-secret-plaintext {
				user-select: all;
			}
			.hint {
				color: var(--text-hint-color);
				font-size: 0.75rem;
				margin-top: 0.25rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class InboundSecretDialogComponent extends TranslationBaseComponent {
	/**
	 * The one-time envelope. Held only for as long as the dialog is open and deliberately never
	 * copied onto the page component or into any store.
	 */
	@Input() secret: IDocumentInboundAddressSecret | null = null;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<InboundSecretDialogComponent>,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	/**
	 * Copies one field to the clipboard.
	 *
	 * A denied clipboard permission is swallowed, exactly as in `docs-row-actions.service.ts`:
	 * the value is still selectable on screen (`user-select: all`), so there is nothing for the
	 * user to do about a failure and nothing to roll back.
	 */
	async copy(value: string | null | undefined, messageKey: string): Promise<void> {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			this.toastrService.success(this.getTranslation(messageKey));
		} catch {
			// Clipboard permission denied / unavailable — nothing to roll back.
		}
	}

	/** The only way out. Closing IS the acknowledgement; there is nothing to cancel. */
	acknowledge(): void {
		this.dialogRef.close(true);
	}
}
