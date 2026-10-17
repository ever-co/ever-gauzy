import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbIconModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, forkJoin, Observable, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import {
	ID,
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	IInboxProviderAccountCheck,
	IInboxProviderAccountCreated,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum,
	IOrganization,
	PermissionsEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import {
	apiErrorMessage,
	InboxSettingsView,
	IInboxOneTimeValue,
	oneTimeValuesOf,
	viewOfLoadError
} from './inbox-settings.helpers';
import { InboxOneTimeSecretDialogComponent } from './one-time-secret-dialog.component';
import {
	IInboxProviderAccountDialogResult,
	InboxProviderAccountDialogComponent
} from './provider-account-dialog.component';
import { capabilitiesOf } from './provider-config-form.helpers';

/** An account with what its card shows. */
export interface IInboxProviderAccountRow {
	account: IInboxProviderAccount;
	provider: IEmailProviderDescriptor | null;
	capabilities: IEmailProviderDescriptor['capabilities'] | null;
	/** A tenant-wide account the user may not change (`ALL_ORG_EDIT` missing). */
	readOnly: boolean;
}

/**
 * Settings → Inbox → Providers (`/pages/settings/inbox-providers`, plan 04 §5.2, G-P4-2; `INBOX_MAILBOX_MANAGE`): the
 * email provider plugins this server loads, each with what it can do and an "Add account" action, and the accounts of
 * the selected organization and of the tenant.
 *
 * - **Add / edit** opens the provider's own form, rendered from its `configSchema`
 *   ({@link InboxProviderAccountDialogComponent}). Secrets are write-only: a card says which are set, never what they
 *   are; a secret the server generated (Postmark's webhook credential) is shown once, in a dialog that only an
 *   acknowledgement closes.
 * - **Webhook URL:** the URL to configure at the provider is the API's answer (`webhookUrl`, built on the API's own
 *   public URL), never a host this page assumes. A provider whose URL carries a credential shows it only once.
 * - **Test connection** (`verifyAccount`), **enable / disable**, **default outbound** (the scope's outbound mail goes
 *   through it), **delete** (refused by the API while a mailbox receives through the account).
 *
 * The page asks the API first: a 404 means the Inbox email features are off on this installation, and the page says so.
 */
@Component({
	selector: 'ngx-inbox-providers-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, TranslatePipe],
	template: `
		<nb-card class="page" data-test="providers-page">
			<nb-card-header>
				<h4>{{ 'INBOX.SETTINGS.PROVIDERS.TITLE' | translate }}</h4>
				<p class="subtitle">{{ 'INBOX.SETTINGS.PROVIDERS.SUBTITLE' | translate }}</p>
			</nb-card-header>
			<nb-card-body>
				@switch (view()) {
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'INBOX.SETTINGS.UNAVAILABLE' | translate }}</p>
					}
					@case ('forbidden') {
						<p data-test="forbidden">{{ 'INBOX.SETTINGS.FORBIDDEN' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'INBOX.SETTINGS.ERRORS.LOAD' | translate
						}}</nb-alert>
						<button nbButton size="small" type="button" data-test="retry" (click)="reload()">
							{{ 'INBOX.RETRY' | translate }}
						</button>
					}
					@default {
						@if (actionError(); as message) {
							<nb-alert
								status="danger"
								role="alert"
								closable
								data-test="action-error"
								(close)="actionError.set(null)"
								>{{ message | translate }}</nb-alert
							>
						}

						<section class="section" data-test="providers">
							<h5>{{ 'INBOX.SETTINGS.PROVIDERS.AVAILABLE' | translate }}</h5>
							<div class="cards">
								@for (provider of providers(); track provider.id) {
									<div class="card" [attr.data-test]="'provider-' + provider.id">
										<div class="card-title">{{ provider.displayName }}</div>
										@if (provider.description) {
											<p class="hint">{{ provider.description }}</p>
										}
										<div class="chips">
											@if (provider.capabilities.inbound) {
												<span class="chip">{{
													'INBOX.SETTINGS.CAPABILITY.INBOUND' | translate
												}}</span>
											}
											@if (provider.capabilities.outbound) {
												<span class="chip">{{
													'INBOX.SETTINGS.CAPABILITY.OUTBOUND' | translate
												}}</span>
											}
											@if (provider.capabilities.customDomains) {
												<span class="chip">{{
													'INBOX.SETTINGS.CAPABILITY.CUSTOM_DOMAINS' | translate
												}}</span>
											}
										</div>
										<button
											nbButton
											size="small"
											status="primary"
											type="button"
											[attr.data-test]="'add-' + provider.id"
											(click)="add(provider)"
										>
											{{ 'INBOX.SETTINGS.PROVIDERS.ADD' | translate }}
										</button>
									</div>
								} @empty {
									<p class="hint" data-test="no-providers">
										{{ 'INBOX.SETTINGS.PROVIDERS.NO_PROVIDERS' | translate }}
									</p>
								}
							</div>
						</section>

						<section class="section" data-test="accounts">
							<h5>{{ 'INBOX.SETTINGS.PROVIDERS.ACCOUNTS' | translate }}</h5>
							@for (row of rows(); track row.account.id) {
								<div
									class="account"
									[class.disabled]="row.account.status === statuses.DISABLED"
									[attr.data-test]="'account-' + row.account.id"
								>
									<div class="account-head">
										<div>
											<div class="card-title">{{ row.account.name }}</div>
											<div class="meta">
												<span>{{ row.provider?.displayName ?? row.account.providerId }}</span>
												<span class="chip">{{
													'INBOX.SETTINGS.PROVIDERS.SCOPE_' + row.account.scope | translate
												}}</span>
												<span
													class="chip"
													[class.chip-success]="row.account.status === statuses.ACTIVE"
													[class.chip-danger]="row.account.status === statuses.ERROR"
													[attr.data-test]="'status-' + row.account.id"
													>{{
														'INBOX.SETTINGS.STATUS.' + row.account.status | translate
													}}</span
												>
												@if (row.account.isDefaultOutbound) {
													<span
														class="chip chip-primary"
														[attr.data-test]="'default-' + row.account.id"
														>{{
															'INBOX.SETTINGS.PROVIDERS.IS_DEFAULT_OUTBOUND' | translate
														}}</span
													>
												}
											</div>
										</div>
										<div class="actions">
											<button
												nbButton
												size="tiny"
												status="basic"
												type="button"
												[attr.data-test]="'verify-' + row.account.id"
												[disabled]="busy(row) || row.readOnly"
												(click)="verify(row)"
											>
												{{ 'INBOX.SETTINGS.PROVIDERS.TEST' | translate }}
											</button>
											<button
												nbButton
												size="tiny"
												status="basic"
												type="button"
												[attr.data-test]="'edit-' + row.account.id"
												[disabled]="busy(row) || row.readOnly || !row.provider"
												(click)="edit(row)"
											>
												{{ 'INBOX.SETTINGS.EDIT' | translate }}
											</button>
											@if (row.account.status === statuses.DISABLED) {
												<button
													nbButton
													size="tiny"
													status="basic"
													type="button"
													[attr.data-test]="'enable-' + row.account.id"
													[disabled]="busy(row) || row.readOnly"
													(click)="setEnabled(row, true)"
												>
													{{ 'INBOX.SETTINGS.PROVIDERS.ENABLE' | translate }}
												</button>
											} @else {
												<button
													nbButton
													size="tiny"
													status="basic"
													type="button"
													[attr.data-test]="'disable-' + row.account.id"
													[disabled]="busy(row) || row.readOnly"
													(click)="setEnabled(row, false)"
												>
													{{ 'INBOX.SETTINGS.PROVIDERS.DISABLE' | translate }}
												</button>
											}
											@if (row.capabilities?.outbound && !row.account.isDefaultOutbound) {
												<button
													nbButton
													size="tiny"
													status="basic"
													type="button"
													[attr.data-test]="'make-default-' + row.account.id"
													[disabled]="
														busy(row) ||
														row.readOnly ||
														row.account.status === statuses.DISABLED
													"
													(click)="makeDefault(row)"
												>
													{{ 'INBOX.SETTINGS.PROVIDERS.MAKE_DEFAULT' | translate }}
												</button>
											}
											<button
												nbButton
												size="tiny"
												status="danger"
												ghost
												type="button"
												[attr.data-test]="'delete-' + row.account.id"
												[disabled]="busy(row) || row.readOnly"
												(click)="confirmDelete.set(row.account.id ?? null)"
											>
												{{ 'INBOX.SETTINGS.DELETE' | translate }}
											</button>
										</div>
									</div>

									@if (row.readOnly) {
										<p class="hint">
											{{ 'INBOX.SETTINGS.PROVIDERS.TENANT_READ_ONLY' | translate }}
										</p>
									}
									@if (!row.provider) {
										<p class="hint warn">{{ 'INBOX.SETTINGS.PROVIDERS.NOT_LOADED' | translate }}</p>
									}

									@if (confirmDelete() === row.account.id) {
										<div
											class="confirm"
											role="alertdialog"
											[attr.data-test]="'confirm-delete-' + row.account.id"
										>
											<span>{{ 'INBOX.SETTINGS.PROVIDERS.DELETE_CONFIRM' | translate }}</span>
											<button
												nbButton
												size="tiny"
												status="danger"
												type="button"
												[attr.data-test]="'confirm-delete-yes-' + row.account.id"
												[disabled]="busy(row)"
												(click)="remove(row)"
											>
												{{ 'INBOX.SETTINGS.DELETE' | translate }}
											</button>
											<button
												nbButton
												size="tiny"
												ghost
												type="button"
												(click)="confirmDelete.set(null)"
											>
												{{ 'INBOX.SETTINGS.CANCEL' | translate }}
											</button>
										</div>
									}

									<dl class="details">
										@if (row.capabilities?.inbound) {
											<dt>{{ 'INBOX.SETTINGS.PROVIDERS.WEBHOOK_URL' | translate }}</dt>
											<dd>
												@if (row.account.webhookUrl; as url) {
													<code [attr.data-test]="'webhook-' + row.account.id">{{
														url
													}}</code>
													<button
														nbButton
														ghost
														size="tiny"
														type="button"
														[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
														(click)="copy(url)"
													>
														<nb-icon icon="copy-outline"></nb-icon>
													</button>
													<p class="hint">
														{{ 'INBOX.SETTINGS.PROVIDERS.WEBHOOK_HINT' | translate }}
													</p>
												} @else {
													<span
														class="hint"
														[attr.data-test]="'webhook-once-' + row.account.id"
														>{{
															'INBOX.SETTINGS.PROVIDERS.WEBHOOK_SHOWN_ONCE' | translate
														}}</span
													>
												}
											</dd>
										}
										@if (row.account.secretsSet?.length) {
											<dt>{{ 'INBOX.SETTINGS.PROVIDERS.SECRETS_SET' | translate }}</dt>
											<dd [attr.data-test]="'secrets-' + row.account.id">
												{{ secretLabels(row) }}
											</dd>
										}
										<dt>{{ 'INBOX.SETTINGS.PROVIDERS.LAST_CHECK' | translate }}</dt>
										<dd>
											@if (row.account.lastVerifiedAt) {
												{{ row.account.lastVerifiedAt | date: 'medium' }}
											} @else {
												{{ 'INBOX.SETTINGS.PROVIDERS.NEVER_CHECKED' | translate }}
											}
										</dd>
										@if (row.account.lastError) {
											<dt>{{ 'INBOX.SETTINGS.PROVIDERS.LAST_ERROR' | translate }}</dt>
											<dd class="warn" [attr.data-test]="'last-error-' + row.account.id">
												{{ row.account.lastError }}
											</dd>
										}
									</dl>

									@if (checks()[row.account.id ?? '']; as check) {
										<nb-alert
											size="tiny"
											[status]="check.ok ? 'success' : 'danger'"
											[attr.data-test]="'check-' + row.account.id"
										>
											{{
												(check.ok
													? 'INBOX.SETTINGS.PROVIDERS.CHECK_OK'
													: 'INBOX.SETTINGS.PROVIDERS.CHECK_FAILED'
												) | translate
											}}
											@if (check.message) {
												— {{ check.message }}
											}
										</nb-alert>
									}
								</div>
							} @empty {
								<p class="hint" data-test="no-accounts">
									{{ 'INBOX.SETTINGS.PROVIDERS.NO_ACCOUNTS' | translate }}
								</p>
							}
						</section>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.page h4 {
				margin: 0;
			}
			.subtitle,
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.85rem;
				opacity: 0.75;
			}
			.warn {
				color: var(--text-warning-color, #ffaa00);
				opacity: 1;
			}
			.section {
				margin-bottom: 1.5rem;
			}
			.cards {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
				gap: 0.75rem;
			}
			.card,
			.account {
				padding: 0.75rem 1rem;
				border: 1px solid var(--border-basic-color-4, #e4e9f2);
				border-radius: 0.5rem;
			}
			.card {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				align-items: flex-start;
			}
			.account {
				margin-bottom: 0.75rem;
			}
			.account.disabled {
				opacity: 0.7;
			}
			.card-title {
				font-weight: 600;
			}
			.account-head {
				display: flex;
				justify-content: space-between;
				gap: 1rem;
				flex-wrap: wrap;
			}
			.meta,
			.chips,
			.actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.35rem;
				align-items: center;
				font-size: 0.85rem;
			}
			.chip {
				padding: 0 0.45rem;
				border: 1px solid var(--border-basic-color-4, #c5cee0);
				border-radius: 0.6rem;
				font-size: 0.72rem;
			}
			.chip-success {
				border-color: var(--color-success-default, #00d68f);
			}
			.chip-danger {
				border-color: var(--color-danger-default, #ff3d71);
			}
			.chip-primary {
				border-color: var(--color-primary-default, #3366ff);
			}
			.confirm {
				display: flex;
				gap: 0.5rem;
				align-items: center;
				margin-top: 0.5rem;
			}
			.details {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: 0.25rem 1rem;
				margin: 0.75rem 0 0;
				font-size: 0.85rem;
			}
			.details dt {
				font-weight: 600;
			}
			.details dd {
				margin: 0;
				overflow-wrap: anywhere;
			}
			.loading {
				min-height: 8rem;
			}
		`
	]
})
export class InboxProvidersPageComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly store = inject(Store);
	private readonly dialogs = inject(NbDialogService);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly statuses = InboxProviderAccountStatusEnum;

	readonly view = signal<InboxSettingsView>('loading');
	readonly providers = signal<IEmailProviderDescriptor[]>([]);
	readonly accounts = signal<IInboxProviderAccount[]>([]);
	readonly organizationId = signal<ID | null>(null);
	/** Accounts with an action in flight. */
	readonly busyIds = signal<ReadonlySet<string>>(new Set());
	/** The account whose delete waits for a confirmation. */
	readonly confirmDelete = signal<string | null>(null);
	/** The last connection test of each account, this visit. */
	readonly checks = signal<Record<string, IInboxProviderAccountCheck>>({});
	readonly actionError = signal<string | null>(null);

	readonly rows = computed<IInboxProviderAccountRow[]>(() => {
		const providers = new Map(this.providers().map((provider) => [provider.id, provider]));
		const canManageTenant = this.canManageTenant();
		return this.accounts().map((account) => {
			const provider = providers.get(account.providerId) ?? null;
			return {
				account,
				provider,
				capabilities: capabilitiesOf(account, provider),
				readOnly: account.scope === InboxProviderAccountScopeEnum.TENANT && !canManageTenant
			};
		});
	});

	/** Loads the page again (another organization, a retry, a saved account). */
	private readonly load$ = new Subject<void>();

	ngOnInit(): void {
		this.load$
			.pipe(
				switchMap(() => {
					this.view.set('loading');
					return this.fetch().pipe(
						catchError((error: unknown) => {
							this.view.set(viewOfLoadError(error));
							return EMPTY;
						})
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ providers, accounts }) => {
				this.providers.set(providers ?? []);
				this.accounts.set(accounts ?? []);
				this.checks.set({});
				this.confirmDelete.set(null);
				this.view.set('ready');
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization | null | undefined) => !!organization?.id),
				map((organization: IOrganization) => organization.id as ID),
				distinctUntilChanged(),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((organizationId) => {
				this.organizationId.set(organizationId);
				this.reload();
			});
	}

	private fetch(): Observable<{ providers: IEmailProviderDescriptor[]; accounts: IInboxProviderAccount[] }> {
		return forkJoin({
			providers: this.api.providers(),
			accounts: this.api.accounts(this.organizationId())
		});
	}

	reload(): void {
		this.actionError.set(null);
		this.load$.next();
	}

	canManageTenant(): boolean {
		return this.store.hasPermission(PermissionsEnum.ALL_ORG_EDIT);
	}

	busy(row: IInboxProviderAccountRow): boolean {
		return this.busyIds().has(row.account.id ?? '');
	}

	private setBusy(id: string, on: boolean): void {
		const next = new Set(this.busyIds());
		if (on) next.add(id);
		else next.delete(id);
		this.busyIds.set(next);
	}

	/** The labels of the secrets an account has a value for (the provider's own titles; never the values). */
	secretLabels(row: IInboxProviderAccountRow): string {
		const titles = row.provider?.configSchema?.properties ?? {};
		return (row.account.secretsSet ?? []).map((name) => titles[name]?.title || name).join(', ');
	}

	// ---------------------------------------------------------------- add / edit

	add(provider: IEmailProviderDescriptor): void {
		this.openDialog(null, provider.id);
	}

	edit(row: IInboxProviderAccountRow): void {
		if (row.readOnly || !row.provider) return;
		this.openDialog(row.account, row.account.providerId);
	}

	private openDialog(account: IInboxProviderAccount | null, providerId: string): void {
		this.actionError.set(null);
		this.dialogs
			.open(InboxProviderAccountDialogComponent, {
				context: {
					providers: this.providers(),
					account,
					initialProviderId: providerId,
					organizationId: this.organizationId(),
					canManageTenant: this.canManageTenant()
				},
				// Neither Escape nor a click outside closes it: a save in flight must reach its one-time values.
				closeOnEsc: false,
				closeOnBackdropClick: false
			})
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result?: IInboxProviderAccountDialogResult) => {
				if (!result?.account) return;
				const provider = this.providers().find((entry) => entry.id === result.account.providerId) ?? null;
				// Before anything else: the only copy of a generated secret is in this answer.
				this.reveal(oneTimeValuesOf(result.account, provider));
				this.toastr.success(account ? 'INBOX.SETTINGS.TOAST.SAVED' : 'INBOX.SETTINGS.TOAST.ADDED');
				// A new outbound default takes the flag from the scope's previous one: read the list again.
				this.reload();
			});
	}

	/** Shows the values the API answered once; only an acknowledgement closes it. */
	private reveal(values: IInboxOneTimeValue[]): void {
		if (values.length === 0) return;
		this.dialogs.open(InboxOneTimeSecretDialogComponent, {
			context: { values, hint: 'INBOX.SETTINGS.ONE_TIME.PROVIDER_HINT' },
			closeOnEsc: false,
			closeOnBackdropClick: false
		});
	}

	// ---------------------------------------------------------------- account actions

	verify(row: IInboxProviderAccountRow): void {
		const id = row.account.id;
		if (!id || this.busy(row) || row.readOnly) return;
		this.run(id, this.api.verifyAccount(id, this.organizationId()), (check) => {
			this.checks.set({ ...this.checks(), [id]: check });
			// The test also decided the account's status (ACTIVE or ERROR) and its last error.
			this.refreshAccounts();
		});
	}

	setEnabled(row: IInboxProviderAccountRow, enabled: boolean): void {
		const id = row.account.id;
		if (!id || this.busy(row) || row.readOnly) return;
		const status = enabled ? InboxProviderAccountStatusEnum.ACTIVE : InboxProviderAccountStatusEnum.DISABLED;
		this.run(id, this.api.updateAccount(id, { status }, this.organizationId()), (account) => this.replace(account));
	}

	makeDefault(row: IInboxProviderAccountRow): void {
		const id = row.account.id;
		if (!id || this.busy(row) || row.readOnly) return;
		this.run(id, this.api.updateAccount(id, { isDefaultOutbound: true }, this.organizationId()), () =>
			// The scope's previous default lost the flag: read the list again.
			this.refreshAccounts()
		);
	}

	remove(row: IInboxProviderAccountRow): void {
		const id = row.account.id;
		if (!id || this.busy(row) || row.readOnly) return;
		this.run(id, this.api.removeAccount(id, this.organizationId()), () => {
			this.confirmDelete.set(null);
			this.accounts.set(this.accounts().filter((account) => account.id !== id));
			this.toastr.success('INBOX.SETTINGS.TOAST.DELETED');
		});
	}

	/** Runs one account's action: busy while in flight, the API's refusal shown on the page. */
	private run<T>(id: string, request$: Observable<T>, done: (result: T) => void): void {
		this.setBusy(id, true);
		this.actionError.set(null);
		request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (result) => {
				this.setBusy(id, false);
				done(result);
			},
			error: (error: unknown) => {
				this.setBusy(id, false);
				this.actionError.set(apiErrorMessage(error) ?? 'INBOX.SETTINGS.ERRORS.ACTION');
			}
		});
	}

	/** One account as the API answered it (a one-time value of an answer is never kept on the page). */
	private replace(answer: IInboxProviderAccountCreated | IInboxProviderAccount): void {
		const account = { ...answer } as Partial<IInboxProviderAccountCreated>;
		delete account.oneTimeSecrets;
		delete account.oneTimeWebhookUrl;
		this.accounts.set(
			this.accounts().map((entry) =>
				entry.id === account.id ? ({ ...entry, ...account } as IInboxProviderAccount) : entry
			)
		);
	}

	/** The accounts again, without the page's loading state (a failure keeps the list as it was). */
	private refreshAccounts(): void {
		const organizationId = this.organizationId();
		this.api
			.accounts(organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				// An answer for an organization that is no longer the selected one is dropped.
				next: (accounts) => {
					if (this.organizationId() === organizationId) this.accounts.set(accounts ?? []);
				},
				error: () => undefined
			});
	}

	async copy(value: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			this.toastr.success('INBOX.SETTINGS.TOAST.COPIED');
		} catch {
			// No clipboard permission: the value is still selectable on screen.
		}
	}
}
