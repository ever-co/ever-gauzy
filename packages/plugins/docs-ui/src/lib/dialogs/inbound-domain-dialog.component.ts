import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbInputModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { normalizeInboundDomain, normalizeInboundLocalPart } from '../models/docs-inbound.model';

/** What the dialog resolves with on confirm (`null` on cancel). */
export interface IDocsInboundDomainDialogResult {
	domain: string;
	localPart: string;
	importBodyAsNote: boolean;
}

/**
 * Registers an inbound capture address on a domain the organization owns.
 *
 * Template-driven like every other form in this package (`category-dialog.component.ts`): a
 * disabled confirm plus a re-check inside `confirm()`, no reactive forms.
 *
 * The two fields are normalized with the same rules the server applies
 * (`capture/inbound-address.util.ts`), so the previewed address is the address that will
 * actually be created — lower-cased, with a stray leading `@` or trailing dot on the domain
 * already removed. The server re-validates regardless; this only avoids a submit that is
 * certain to 400.
 *
 * `senderAllowlist` is deliberately **not** collected here. It is editable per address on the
 * settings page, and asking for it up front would front-load a decision most tenants make after
 * they have seen the first message arrive.
 *
 * Standalone — opened from the lazily route-loaded inbound settings page.
 */
@Component({
	selector: 'gz-docs-inbound-domain-dialog',
	imports: [CommonModule, FormsModule, TranslateModule, NbButtonModule, NbCardModule, NbInputModule, NbToggleModule],
	template: `
		<nb-card class="docs-dialog docs-inbound-domain-dialog">
			<nb-card-header>{{ 'DOCS.INBOUND.DIALOG_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<label class="label" for="docs-inbound-domain">{{ 'DOCS.INBOUND.DOMAIN' | translate }}</label>
				<input
					id="docs-inbound-domain"
					nbInput
					fullWidth
					type="text"
					maxlength="255"
					autocomplete="off"
					placeholder="{{ 'DOCS.INBOUND.DOMAIN_PLACEHOLDER' | translate }}"
					[(ngModel)]="domain"
					(keydown.enter)="confirm()"
				/>
				<div class="hint" [class.warn]="!!domain?.trim() && !normalizedDomain">
					{{
						(!!domain?.trim() && !normalizedDomain
							? 'DOCS.INBOUND.DOMAIN_INVALID'
							: 'DOCS.INBOUND.DOMAIN_HINT'
						) | translate
					}}
				</div>

				<label class="label" for="docs-inbound-local-part">{{ 'DOCS.INBOUND.LOCAL_PART' | translate }}</label>
				<input
					id="docs-inbound-local-part"
					nbInput
					fullWidth
					type="text"
					maxlength="64"
					autocomplete="off"
					placeholder="{{ 'DOCS.INBOUND.LOCAL_PART_PLACEHOLDER' | translate }}"
					[(ngModel)]="localPart"
					(keydown.enter)="confirm()"
				/>
				<div class="hint" [class.warn]="!!localPart?.trim() && !normalizedLocalPart">
					{{
						(!!localPart?.trim() && !normalizedLocalPart
							? 'DOCS.INBOUND.LOCAL_PART_INVALID'
							: 'DOCS.INBOUND.LOCAL_PART_HINT'
						) | translate
					}}
				</div>

				<div class="docs-inbound-preview" *ngIf="previewAddress">
					<span class="hint">{{ 'DOCS.INBOUND.RESULTING_ADDRESS' | translate }}</span>
					<code>{{ previewAddress }}</code>
				</div>

				<nb-toggle class="docs-inbound-toggle" labelPosition="end" [(ngModel)]="importBodyAsNote">
					{{ 'DOCS.INBOUND.IMPORT_BODY' | translate }}
				</nb-toggle>
				<div class="hint">{{ 'DOCS.INBOUND.IMPORT_BODY_HINT' | translate }}</div>

				<p class="hint warn">{{ 'DOCS.INBOUND.DIALOG_PENDING_NOTICE' | translate }}</p>
			</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost (click)="cancel()">{{ 'DOCS.UPLOAD.CANCEL' | translate }}</button>
				<button nbButton status="primary" [disabled]="!canConfirm" (click)="confirm()">
					{{ 'DOCS.INBOUND.ADD_CONFIRM' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.docs-inbound-domain-dialog {
				width: 30rem;
				max-width: 92vw;
			}
			.label {
				display: block;
				margin: 0.75rem 0 0.25rem;
				font-weight: 600;
			}
			.hint {
				color: var(--text-hint-color);
				font-size: 0.75rem;
				margin-top: 0.25rem;

				&.warn {
					color: var(--text-warning-color);
				}
			}
			.docs-inbound-preview {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-top: 1rem;

				code {
					font-size: 0.8125rem;
					overflow-wrap: anywhere;
				}
			}
			.docs-inbound-toggle {
				display: block;
				margin-top: 1rem;
			}
			.docs-dialog-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class InboundDomainDialogComponent {
	public domain = '';
	public localPart = 'docs';
	public importBodyAsNote = false;

	constructor(private readonly dialogRef: NbDialogRef<InboundDomainDialogComponent>) {}

	/** The domain as the server will store it, or `null` while it is not yet valid. */
	get normalizedDomain(): string | null {
		return normalizeInboundDomain(this.domain);
	}

	/** The mailbox name as the server will store it, or `null` while it is not yet valid. */
	get normalizedLocalPart(): string | null {
		return normalizeInboundLocalPart(this.localPart);
	}

	/**
	 * The address that will be created, or `''` while either half is still invalid.
	 *
	 * A plain string: it is only interpolated, so a fresh value per change-detection pass costs
	 * a comparison, not a re-render. Nothing binds an object or an array to a getter here — that
	 * is what wedged the hub's main thread once already.
	 */
	get previewAddress(): string {
		const domain = this.normalizedDomain;
		const localPart = this.normalizedLocalPart;
		return domain && localPart ? `${localPart}@${domain}` : '';
	}

	get canConfirm(): boolean {
		return !!this.normalizedDomain && !!this.normalizedLocalPart;
	}

	confirm(): void {
		const domain = this.normalizedDomain;
		const localPart = this.normalizedLocalPart;
		// Re-checked rather than trusted from `canConfirm`: Enter reaches this without the
		// button, and the button's disabled state is a hint, not a guarantee.
		if (!domain || !localPart) return;
		const result: IDocsInboundDomainDialogResult = {
			domain,
			localPart,
			importBodyAsNote: this.importBodyAsNote
		};
		this.dialogRef.close(result);
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
