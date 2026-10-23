import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogRef,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	ID,
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	IInboxProviderAccountCreated,
	IInboxProviderAccountUpdateInput,
	InboxProviderAccountScopeEnum
} from '@gauzy/contracts';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { apiErrorMessage } from './inbox-settings.helpers';
import { InboxProviderConfigFormComponent } from './provider-config-form.component';
import {
	initialProviderConfigState,
	IProviderConfigFormState,
	providerConfigErrors,
	providerConfigPayload
} from './provider-config-form.helpers';

/** What the dialog closes with after a save (nothing when cancelled). */
export interface IInboxProviderAccountDialogResult {
	account: IInboxProviderAccountCreated;
}

/** The longest account name the API takes. */
export const PROVIDER_ACCOUNT_NAME_MAX = 120;

/**
 * Adds or edits a provider account (Settings → Inbox → Providers): the provider (a new account only), a name, who it
 * is for (this organization, or — with `ALL_ORG_EDIT` — the whole tenant), whether the scope's outbound mail goes
 * through it, and the provider plugin's own form ({@link InboxProviderConfigFormComponent}). The dialog saves by
 * itself, so a refusal of the API is shown here with everything typed kept.
 *
 * An edit sends `config` only when it changed (a rename alone does not touch the sealed secrets).
 */
@Component({
	selector: 'ngx-inbox-provider-account-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		TranslatePipe,
		InboxProviderConfigFormComponent
	],
	template: `
		<nb-card class="dialog" data-test="account-dialog" [nbSpinner]="saving()">
			<nb-card-header>
				{{
					(account ? 'INBOX.SETTINGS.PROVIDERS.EDIT_TITLE' : 'INBOX.SETTINGS.PROVIDERS.ADD_TITLE')
						| translate: { name: account?.name ?? '' }
				}}
			</nb-card-header>
			<nb-card-body>
				@if (apiError(); as message) {
					<nb-alert status="danger" role="alert" data-test="dialog-error">{{ message | translate }}</nb-alert>
				}

				<div class="field">
					<label class="label" for="inbox-account-provider">{{
						'INBOX.SETTINGS.PROVIDERS.PROVIDER' | translate
					}}</label>
					@if (account) {
						<p data-test="provider-name">{{ provider()?.displayName ?? account.providerId }}</p>
					} @else {
						<nb-select
							fullWidth
							size="small"
							id="inbox-account-provider"
							data-test="provider-select"
							[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
							[selected]="providerId()"
							(selectedChange)="selectProvider($event)"
						>
							@for (entry of providers; track entry.id) {
								<nb-option [value]="entry.id">{{ entry.displayName }}</nb-option>
							}
						</nb-select>
					}
					@if (provider()?.description; as description) {
						<p class="hint">{{ description }}</p>
					}
				</div>

				@if (provider(); as current) {
					<div class="field">
						<label class="label" for="inbox-account-name"
							>{{ 'INBOX.SETTINGS.PROVIDERS.NAME' | translate }}
							<span class="required" aria-hidden="true">*</span></label
						>
						<input
							nbInput
							fullWidth
							fieldSize="small"
							id="inbox-account-name"
							data-test="name"
							[attr.maxlength]="nameMax"
							[ngModel]="name()"
							[ngModelOptions]="standalone"
							(ngModelChange)="name.set($event)"
						/>
						@if (submitted() && nameError()) {
							<p class="error" role="alert" data-test="error-name">
								{{ 'INBOX.SETTINGS.FORM.ERRORS.REQUIRED' | translate }}
							</p>
						}
					</div>

					@if (!account && canManageTenant) {
						<div class="field">
							<label class="label" for="inbox-account-scope">{{
								'INBOX.SETTINGS.PROVIDERS.SCOPE' | translate
							}}</label>
							<nb-select
								fullWidth
								size="small"
								id="inbox-account-scope"
								data-test="scope"
								[selected]="scope()"
								(selectedChange)="scope.set($event)"
							>
								<nb-option [value]="scopes.ORGANIZATION">{{
									'INBOX.SETTINGS.PROVIDERS.SCOPE_ORGANIZATION' | translate
								}}</nb-option>
								<nb-option [value]="scopes.TENANT">{{
									'INBOX.SETTINGS.PROVIDERS.SCOPE_TENANT' | translate
								}}</nb-option>
							</nb-select>
						</div>
					}

					@if (current.capabilities.outbound) {
						<div class="field">
							<nb-toggle
								data-test="default-outbound"
								[checked]="isDefaultOutbound()"
								(checkedChange)="isDefaultOutbound.set($event)"
							>
								{{ 'INBOX.SETTINGS.PROVIDERS.DEFAULT_OUTBOUND' | translate }}
							</nb-toggle>
							<p class="hint">{{ 'INBOX.SETTINGS.PROVIDERS.DEFAULT_OUTBOUND_HINT' | translate }}</p>
						</div>
					}

					<h6 class="section">{{ 'INBOX.SETTINGS.PROVIDERS.CONFIGURATION' | translate }}</h6>
					<ngx-inbox-provider-config-form
						[schema]="current.configSchema"
						[account]="account"
						[errors]="shownErrors()"
						[disabled]="saving()"
						[(state)]="configState"
					></ngx-inbox-provider-config-form>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" data-test="cancel" [disabled]="saving()" (click)="cancel()">
					{{ 'INBOX.SETTINGS.CANCEL' | translate }}
				</button>
				<button
					nbButton
					status="primary"
					type="button"
					data-test="save"
					[disabled]="saving() || !provider()"
					(click)="save()"
				>
					{{ 'INBOX.SETTINGS.SAVE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.dialog {
				width: 40rem;
				max-width: 94vw;
				max-height: 90vh;
			}
			nb-card-body {
				overflow: auto;
			}
			.field {
				margin-bottom: 0.9rem;
			}
			.label {
				display: block;
				margin-bottom: 0.25rem;
				font-weight: 600;
			}
			.required,
			.error {
				color: var(--text-danger-color, #ff3d71);
			}
			.error,
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.8rem;
			}
			.hint {
				opacity: 0.75;
			}
			.section {
				margin: 1rem 0 0.5rem;
			}
			.footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class InboxProviderAccountDialogComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly dialogRef = inject<NbDialogRef<InboxProviderAccountDialogComponent>>(NbDialogRef);
	private readonly destroyRef = inject(DestroyRef);

	// ---------------------------------------------------------------- set through the dialog's `context`

	/** The provider plugins of this server. */
	providers: IEmailProviderDescriptor[] = [];
	/** The account to edit; `null` adds one. */
	account: IInboxProviderAccount | null = null;
	/** The provider a new account starts with. */
	initialProviderId: string | null = null;
	organizationId: ID | null = null;
	/** Whether the user may add a tenant-wide account (`ALL_ORG_EDIT`). */
	canManageTenant = false;

	// ---------------------------------------------------------------- state

	protected readonly scopes = InboxProviderAccountScopeEnum;
	protected readonly nameMax = PROVIDER_ACCOUNT_NAME_MAX;
	protected readonly standalone = { standalone: true };

	readonly providerId = signal<string | null>(null);
	readonly name = signal('');
	readonly scope = signal<InboxProviderAccountScopeEnum>(InboxProviderAccountScopeEnum.ORGANIZATION);
	readonly isDefaultOutbound = signal(false);
	readonly configState = signal<IProviderConfigFormState>({ values: {}, reset: [] });
	readonly submitted = signal(false);
	readonly saving = signal(false);
	readonly apiError = signal<string | null>(null);

	/** The `config` the form started with (an edit sends `config` only when it differs). */
	private initialConfig = '';

	private readonly providerList = signal<IEmailProviderDescriptor[]>([]);
	readonly provider = computed(() => this.providerList().find((entry) => entry.id === this.providerId()) ?? null);
	readonly nameError = computed(() => {
		const name = this.name().trim();
		return !name || name.length > PROVIDER_ACCOUNT_NAME_MAX;
	});
	readonly errors = computed(() =>
		providerConfigErrors(this.provider()?.configSchema, this.configState(), this.account)
	);
	readonly shownErrors = computed(() => (this.submitted() ? this.errors() : {}));

	ngOnInit(): void {
		this.providerList.set(this.providers ?? []);
		if (this.account) {
			this.providerId.set(this.account.providerId);
			this.name.set(this.account.name ?? '');
			this.scope.set(this.account.scope);
			this.isDefaultOutbound.set(!!this.account.isDefaultOutbound);
		} else {
			this.providerId.set(this.initialProviderId ?? this.providers?.[0]?.id ?? null);
			this.name.set(this.provider()?.displayName ?? '');
		}
		this.resetConfig();
	}

	/** Another provider for a new account: its own form, from its defaults. */
	selectProvider(providerId: string): void {
		if (this.account || providerId === this.providerId()) return;
		const previousName = this.provider()?.displayName ?? '';
		this.providerId.set(providerId);
		// A name the user did not change follows the provider.
		if (!this.name().trim() || this.name() === previousName) this.name.set(this.provider()?.displayName ?? '');
		this.submitted.set(false);
		this.apiError.set(null);
		this.resetConfig();
	}

	private resetConfig(): void {
		const schema = this.provider()?.configSchema;
		const state = initialProviderConfigState(schema, this.account);
		this.configState.set(state);
		this.initialConfig = JSON.stringify(providerConfigPayload(schema, state, this.account));
	}

	save(): void {
		const provider = this.provider();
		if (this.saving() || !provider) return;
		this.submitted.set(true);
		if (this.nameError() || Object.keys(this.errors()).length > 0) return;

		const config = providerConfigPayload(provider.configSchema, this.configState(), this.account);
		const name = this.name().trim();
		const request$ = this.account
			? this.api.updateAccount(this.account.id as ID, this.changes(name, config), this.organizationId)
			: this.api.createAccount({
					providerId: provider.id,
					name,
					scope: this.canManageTenant ? this.scope() : InboxProviderAccountScopeEnum.ORGANIZATION,
					...(this.organizationId ? { organizationId: this.organizationId } : {}),
					config,
					...(provider.capabilities.outbound && this.isDefaultOutbound() ? { isDefaultOutbound: true } : {})
				});

		this.saving.set(true);
		this.apiError.set(null);
		request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (account) => {
				this.saving.set(false);
				this.dialogRef.close({ account } satisfies IInboxProviderAccountDialogResult);
			},
			error: (error: unknown) => {
				this.saving.set(false);
				this.apiError.set(apiErrorMessage(error) ?? 'INBOX.SETTINGS.ERRORS.SAVE');
			}
		});
	}

	/** What an edit changes: the name, the outbound default and, when it differs, the configuration. */
	private changes(name: string, config: Record<string, unknown>): IInboxProviderAccountUpdateInput {
		const account = this.account as IInboxProviderAccount;
		const input: IInboxProviderAccountUpdateInput = {};
		if (name !== account.name) input.name = name;
		if (JSON.stringify(config) !== this.initialConfig) input.config = config;
		const outbound = !!this.provider()?.capabilities.outbound && this.isDefaultOutbound();
		if (outbound !== !!account.isDefaultOutbound) input.isDefaultOutbound = outbound;
		return input;
	}

	cancel(): void {
		this.dialogRef.close();
	}
}
