import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
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
	imports: [ReactiveFormsModule, NbButtonModule, NbCardModule, NbInputModule, TranslatePipe],
	template: `
		<nb-card class="check-dialog" data-test="check-dialog">
			<nb-card-header>{{ 'EVER_CONNECT.LOOKUP.TITLE' | translate }}</nb-card-header>
			<nb-card-body [formGroup]="form">
				<p class="hint">{{ 'EVER_CONNECT.LOOKUP.WHAT_IS_SENT' | translate }}</p>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.EMAIL' | translate }}</span>
					<input nbInput fullWidth type="email" data-test="email" name="email" formControlName="email" />
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.VAT' | translate }}</span>
					<input nbInput fullWidth data-test="vat" name="vat" formControlName="vat" />
					@if (vatSuggested) {
						<small class="hint" data-test="vat-suggested">{{
							'EVER_CONNECT.LOOKUP.VAT_SUGGESTED' | translate
						}}</small>
					}
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.REGISTRATION' | translate }}</span>
					<input
						nbInput
						fullWidth
						data-test="registration"
						name="registration"
						formControlName="registration"
					/>
				</label>
				<label class="field">
					<span>{{ 'EVER_CONNECT.LOOKUP.COUNTRY' | translate }}</span>
					<input nbInput data-test="country" name="country" maxlength="2" formControlName="country" />
				</label>
				@if (rows().length) {
					<ul class="results" data-test="results">
						@for (row of rows(); track $index) {
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
				@if (error(); as message) {
					<p class="error" data-test="error">{{ message | translate: errorParams() }}</p>
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
					[disabled]="busy() || !hasInput()"
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
	private readonly destroyRef = inject(DestroyRef);
	private readonly ref = inject(NbDialogRef, {
		optional: true
	}) as NbDialogRef<CheckOnEverPlatformDialogComponent> | null;

	/** What is checked: the fields of the dialog, prefilled from the dialog's context. */
	protected readonly form = inject(NonNullableFormBuilder).group({
		email: '',
		vat: '',
		registration: '',
		country: ''
	});

	// The dialog's context: `NbDialogService` assigns these onto the instance (signal inputs cannot
	// take that). The prefilled values go into the form, where they are edited.
	@Input({ required: true }) organizationId!: string;
	/** The contact's e-mail (prefilled). */
	@Input() set email(value: string | null | undefined) {
		this.form.controls.email.setValue(value ?? '');
	}
	/** A VAT number (prefilled from the contact's fiscal information, as a suggestion). */
	@Input() set vat(value: string | null | undefined) {
		this.form.controls.vat.setValue(value ?? '');
	}
	/** A registration number. */
	@Input() set registration(value: string | null | undefined) {
		this.form.controls.registration.setValue(value ?? '');
	}
	/** The two-letter country the numbers belong to (prefilled from the contact's address). */
	@Input() set country(value: string | null | undefined) {
		this.form.controls.country.setValue(value ?? '');
	}
	/** The VAT field holds a suggestion read from the contact's fiscal information. */
	@Input() vatSuggested = false;

	protected readonly rows = signal<CheckRow[]>([]);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly errorParams = signal<Record<string, unknown>>({});

	/** The public page on Ever Platform of a handle found. */
	protected readonly profileUrl = (handle?: string) => everPlatformProfileUrl(handle ?? '');

	/** Whether there is something to check: an e-mail, a VAT number or a registration number. */
	protected hasInput(): boolean {
		const { email, vat, registration } = this.form.getRawValue();
		return [email, vat, registration].some((value) => value.trim().length > 0);
	}

	/** The identifiers typed, in a fixed order; the country goes with the VAT and registration numbers. */
	private items(): EverConnectLookupItem[] {
		const value = this.form.getRawValue();
		const email = value.email.trim();
		const vat = value.vat.trim();
		const registration = value.registration.trim();
		const country = value.country.trim().toUpperCase() || null;
		const items: EverConnectLookupItem[] = [];
		if (email) items.push({ kind: 'email', value: email });
		if (vat) items.push({ kind: 'vat', value: vat, country });
		if (registration) items.push({ kind: 'registration', value: registration, country });
		return items;
	}

	/** Checks the identifiers typed (through this installation's API) and shows each answer, or why it failed. */
	protected check(): void {
		const items = this.items();
		if (!items.length || this.busy()) return;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.lookup(this.organizationId, items)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => {
					this.rows.set(
						items.map((item, index) => ({
							kind: item.kind,
							result: answer.items[index] ?? { kind: item.kind, status: 'none' }
						}))
					);
					this.busy.set(false);
				},
				error: (error: HttpErrorResponse) => {
					this.busy.set(false);
					this.rows.set([]);
					const code = (error?.error as { code?: string } | null)?.code ?? null;
					if (error?.status === 429) {
						const seconds = Number(error.headers?.get?.('Retry-After')) || 60;
						this.error.set('EVER_CONNECT.LOOKUP.ERRORS.rate_limited');
						this.errorParams.set({ seconds });
					} else if (code === 'integration_disabled' || code === 'entitlement_required') {
						this.error.set(`EVER_CONNECT.LOOKUP.ERRORS.${code}`);
						this.errorParams.set({});
					} else {
						this.error.set('EVER_CONNECT.LOOKUP.ERRORS.generic');
						this.errorParams.set({});
					}
				}
			});
	}

	/** Closes the dialog. */
	protected close(): void {
		this.ref?.close();
	}
}
