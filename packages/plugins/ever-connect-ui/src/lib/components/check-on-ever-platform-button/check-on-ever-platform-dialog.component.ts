import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbInputModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	EverConnectLookupItem,
	EverConnectLookupResult,
	EverConnectUiService
} from '../../services/ever-connect.service';

/** One row of the result panel: what was checked and what was found. */
export interface CheckRow {
	kind: EverConnectLookupItem['kind'];
	result: EverConnectLookupResult;
}

/** The public page of an organization on Ever Platform. */
export const everPlatformProfileUrl = (handle: string): string => `https://ever.co/${encodeURIComponent(handle)}`;

/**
 * "Check on Ever Platform" for one contact: its e-mail (from the contact), a VAT number and a
 * registration number (typed here; the contact's fiscal information is offered as a suggestion to
 * edit) and the country they belong to. The values go to this installation's API only, which sends
 * Ever Platform salted hashes; nothing is written back to the contact.
 */
@Component({
	selector: 'ngx-ever-connect-check-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbInputModule, TranslatePipe],
	template: `
		<nb-card class="check-dialog" data-test="check-dialog">
			<nb-card-header>{{ 'EVER_CONNECT.LOOKUP.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="hint">{{ 'EVER_CONNECT.LOOKUP.WHAT_IS_SENT' | translate }}</p>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.EMAIL' | translate }}</span>
					<input nbInput fullWidth type="email" data-test="email" name="email" [(ngModel)]="email" />
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.VAT' | translate }}</span>
					<input nbInput fullWidth data-test="vat" name="vat" [(ngModel)]="vat" />
					@if (vatSuggested) {
						<small class="hint" data-test="vat-suggested">{{
							'EVER_CONNECT.LOOKUP.VAT_SUGGESTED' | translate
						}}</small>
					}
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.REGISTRATION' | translate }}</span>
					<input nbInput fullWidth data-test="registration" name="registration" [(ngModel)]="registration" />
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.COUNTRY' | translate }}</span>
					<input nbInput data-test="country" name="country" maxlength="2" [(ngModel)]="country" />
				</label>
				@if (rows.length) {
					<ul class="results" data-test="results">
						@for (row of rows; track $index) {
							<li [attr.data-test]="'result-' + row.kind">
								<strong>{{ 'EVER_CONNECT.LOOKUP.KIND.' + row.kind | translate }}:</strong>
								@switch (row.result.status) {
									@case ('match') {
										<a
											data-test="handle"
											[href]="profileUrl(row.result.handle)"
											target="_blank"
											rel="noopener noreferrer"
											>ever.co/{{ row.result.handle }}</a
										>
										@if (row.result.features?.length) {
											<span class="features" data-test="features">
												{{ 'EVER_CONNECT.LOOKUP.OFFERS' | translate }}
												@for (feature of row.result.features; track feature; let last = $last) {
													{{ 'EVER_CONNECT.LOOKUP.FEATURE.' + feature | translate
													}}{{ last ? '' : ', ' }}
												}
											</span>
										}
									}
									@case ('none') {
										<span data-test="none">{{ 'EVER_CONNECT.LOOKUP.NONE' | translate }}</span>
									}
									@default {
										<span data-test="cannot-be-checked">{{
											'EVER_CONNECT.LOOKUP.CANNOT_BE_CHECKED.' + (row.result.reason || 'empty')
												| translate
										}}</span>
									}
								}
							</li>
						}
					</ul>
				}
				@if (error) {
					<p class="error" data-test="error">{{ error | translate: errorParams }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="actions">
				<button nbButton ghost type="button" data-test="close" (click)="close()">
					{{ 'EVER_CONNECT.CANCEL' | translate }}
				</button>
				<button
					nbButton
					status="primary"
					type="button"
					data-test="check"
					[disabled]="busy || !hasInput()"
					(click)="check()"
				>
					{{ 'EVER_CONNECT.LOOKUP.CHECK' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.check-dialog {
				max-width: 36rem;
			}
			.field {
				display: block;
				margin-bottom: 0.75rem;
			}
			.field > span {
				display: block;
				margin-bottom: 0.25rem;
			}
			.hint {
				font-size: 0.8125rem;
				opacity: 0.8;
			}
			.results {
				padding-left: 1rem;
			}
			.features {
				margin-left: 0.5rem;
			}
			.error {
				color: var(--color-danger-default, #ff3d71);
			}
			.actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class CheckOnEverPlatformDialogComponent {
	private readonly api = inject(EverConnectUiService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);
	private readonly ref = inject(NbDialogRef, {
		optional: true
	}) as NbDialogRef<CheckOnEverPlatformDialogComponent> | null;

	@Input({ required: true }) organizationId!: string;
	@Input() email = '';
	@Input() vat = '';
	@Input() registration = '';
	@Input() country = '';
	/** The VAT field holds a suggestion read from the contact's fiscal information. */
	@Input() vatSuggested = false;

	rows: CheckRow[] = [];
	busy = false;
	error: string | null = null;
	errorParams: Record<string, unknown> = {};

	readonly profileUrl = (handle?: string) => everPlatformProfileUrl(handle ?? '');

	hasInput(): boolean {
		return [this.email, this.vat, this.registration].some((value) => (value ?? '').trim().length > 0);
	}

	/** The identifiers typed, in a fixed order; the country goes with the VAT and registration numbers. */
	items(): EverConnectLookupItem[] {
		const country = (this.country ?? '').trim().toUpperCase() || null;
		const items: EverConnectLookupItem[] = [];
		if ((this.email ?? '').trim()) items.push({ kind: 'email', value: this.email.trim() });
		if ((this.vat ?? '').trim()) items.push({ kind: 'vat', value: this.vat.trim(), country });
		if ((this.registration ?? '').trim()) {
			items.push({ kind: 'registration', value: this.registration.trim(), country });
		}
		return items;
	}

	check(): void {
		const items = this.items();
		if (!items.length || this.busy) return;
		this.busy = true;
		this.error = null;
		this.api
			.lookup(this.organizationId, items)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					this.rows = items.map((item, index) => ({
						kind: item.kind,
						result: answer.items[index] ?? { kind: item.kind, status: 'none' }
					}));
					this.busy = false;
					this.cdr.markForCheck();
				},
				error: (error: HttpErrorResponse) => {
					this.busy = false;
					this.rows = [];
					const code = (error?.error as { code?: string } | null)?.code ?? null;
					if (error?.status === 429) {
						const seconds = Number(error.headers?.get?.('Retry-After')) || 60;
						this.error = 'EVER_CONNECT.LOOKUP.ERRORS.rate_limited';
						this.errorParams = { seconds };
					} else if (code === 'integration_disabled' || code === 'entitlement_required') {
						this.error = `EVER_CONNECT.LOOKUP.ERRORS.${code}`;
						this.errorParams = {};
					} else {
						this.error = 'EVER_CONNECT.LOOKUP.ERRORS.generic';
						this.errorParams = {};
					}
					this.cdr.markForCheck();
				}
			});
	}

	close(): void {
		this.ref?.close();
	}
}
