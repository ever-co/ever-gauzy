import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	OnInit,
	signal,
	type WritableSignal
} from '@angular/core';
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
import { Observable } from 'rxjs';
import { ID, IInboxProviderAccount, InboxMailboxKindEnum, InboxMailboxOwnerTypeEnum } from '@gauzy/contracts';
import { IInboxDirectoryEntry, InboxDirectoryService } from '../services/inbox-directory.service';
import { IInboxCreatedMailbox, InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { apiErrorMessage } from './inbox-settings.helpers';
import {
	emptyMailboxCreateForm,
	IMailboxCreateFormState,
	MAILBOX_CREATE_KINDS,
	MAILBOX_DISPLAY_NAME_MAX,
	MAILBOX_LOCAL_PART_MAX,
	mailboxCreateErrors,
	mailboxCreateInput,
	receivingAccounts
} from './mailbox-settings.helpers';

/** What the dialog closes with after a save (nothing when cancelled). */
export interface IInboxMailboxCreateDialogResult {
	mailbox: IInboxCreatedMailbox;
}

/** A directory list as a picker shows it. */
type DirectoryState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * "Add mailbox" (Settings → Inbox → Mailboxes, plan 04 §5.1, G-P4-1): who owns it (the organization, a team or an
 * employee), how it receives — an address on the platform domain (`GAUZY_INBOX_DOMAIN`, allocated by the API as
 * `<name>.<organization>@<domain>`), an address on the organization's own domain (proven by a DNS TXT record, received
 * through a provider account) or a platform address an existing mailbox forwards to — and its sender allowlist.
 * The dialog saves by itself, so a refusal of the API is shown here with everything typed kept.
 */
@Component({
	selector: 'ngx-inbox-mailbox-create-dialog',
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
		TranslatePipe
	],
	template: `
		<nb-card class="dialog" data-test="mailbox-create-dialog" [nbSpinner]="saving()">
			<nb-card-header>{{ 'INBOX.SETTINGS.MAILBOXES.ADD_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (apiError(); as message) {
					<nb-alert status="danger" role="alert" data-test="dialog-error">{{ message | translate }}</nb-alert>
				}

				<div class="field">
					<label class="label" for="inbox-mailbox-owner-type">{{
						'INBOX.SETTINGS.MAILBOXES.OWNER' | translate
					}}</label>
					<nb-select
						fullWidth
						size="small"
						id="inbox-mailbox-owner-type"
						data-test="owner-type"
						[selected]="form().ownerType"
						(selectedChange)="setOwnerType($event)"
					>
						@for (type of ownerTypes; track type) {
							<nb-option [value]="type">{{ 'INBOX.SETTINGS.OWNER.' + type | translate }}</nb-option>
						}
					</nb-select>
				</div>

				@if (form().ownerType === owners.EMPLOYEE) {
					<div class="field">
						<label class="label" for="inbox-mailbox-employee"
							>{{ 'INBOX.SETTINGS.OWNER.EMPLOYEE' | translate }}
							<span class="required" aria-hidden="true">*</span></label
						>
						@if (employeesState() === 'error') {
							<p class="error" data-test="employees-error">
								{{ 'INBOX.SETTINGS.MAILBOXES.LIST_UNAVAILABLE' | translate }}
							</p>
						} @else {
							<nb-select
								fullWidth
								size="small"
								id="inbox-mailbox-employee"
								data-test="owner-employee"
								[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
								[disabled]="employeesState() !== 'ready'"
								[selected]="form().ownerEmployeeId"
								(selectedChange)="patch({ ownerEmployeeId: $event })"
							>
								@for (entry of employees(); track entry.id) {
									<nb-option [value]="entry.id"
										>{{ entry.name }}
										@if (entry.detail) {
											<span class="detail">({{ entry.detail }})</span>
										}
									</nb-option>
								}
							</nb-select>
						}
						@if (shownErrors()['owner']; as error) {
							<p class="error" role="alert" data-test="error-owner">{{ error.key | translate }}</p>
						}
					</div>
				}

				@if (form().ownerType === owners.TEAM) {
					<div class="field">
						<label class="label" for="inbox-mailbox-team"
							>{{ 'INBOX.SETTINGS.OWNER.TEAM' | translate }}
							<span class="required" aria-hidden="true">*</span></label
						>
						@if (teamsState() === 'error') {
							<p class="error" data-test="teams-error">
								{{ 'INBOX.SETTINGS.MAILBOXES.LIST_UNAVAILABLE' | translate }}
							</p>
						} @else {
							<nb-select
								fullWidth
								size="small"
								id="inbox-mailbox-team"
								data-test="owner-team"
								[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
								[disabled]="teamsState() !== 'ready'"
								[selected]="form().ownerTeamId"
								(selectedChange)="patch({ ownerTeamId: $event })"
							>
								@for (entry of teams(); track entry.id) {
									<nb-option [value]="entry.id">{{ entry.name }}</nb-option>
								}
							</nb-select>
						}
						@if (shownErrors()['owner']; as error) {
							<p class="error" role="alert" data-test="error-owner">{{ error.key | translate }}</p>
						}
					</div>
				}

				<div class="field">
					<label class="label" for="inbox-mailbox-kind">{{
						'INBOX.SETTINGS.MAILBOXES.KIND' | translate
					}}</label>
					<nb-select
						fullWidth
						size="small"
						id="inbox-mailbox-kind"
						data-test="kind"
						[selected]="form().kind"
						(selectedChange)="patch({ kind: $event })"
					>
						@for (kind of kinds; track kind) {
							<nb-option [value]="kind" [disabled]="kind !== customDomain && !platformDomain">{{
								'INBOX.SETTINGS.KIND.' + kind | translate
							}}</nb-option>
						}
					</nb-select>
					<p class="hint">{{ 'INBOX.SETTINGS.KIND_HINT.' + form().kind | translate }}</p>
					@if (shownErrors()['kind']; as error) {
						<p class="error" role="alert" data-test="error-kind">{{ error.key | translate }}</p>
					}
				</div>

				@if (form().kind === customDomain) {
					<div class="row">
						<div class="field grow">
							<label class="label" for="inbox-mailbox-local"
								>{{ 'INBOX.SETTINGS.MAILBOXES.LOCAL_PART' | translate }}
								<span class="required" aria-hidden="true">*</span></label
							>
							<input
								nbInput
								fullWidth
								fieldSize="small"
								id="inbox-mailbox-local"
								data-test="local-part"
								placeholder="support"
								[attr.maxlength]="localPartMax"
								[ngModel]="form().localPart"
								[ngModelOptions]="standalone"
								(ngModelChange)="patch({ localPart: $event })"
							/>
							@if (shownErrors()['localPart']; as error) {
								<p class="error" role="alert" data-test="error-localPart">
									{{ error.key | translate }}
								</p>
							}
						</div>
						<span class="at">&#64;</span>
						<div class="field grow">
							<label class="label" for="inbox-mailbox-domain"
								>{{ 'INBOX.SETTINGS.MAILBOXES.DOMAIN' | translate }}
								<span class="required" aria-hidden="true">*</span></label
							>
							<input
								nbInput
								fullWidth
								fieldSize="small"
								id="inbox-mailbox-domain"
								data-test="domain"
								maxlength="253"
								[ngModel]="form().domain"
								[ngModelOptions]="standalone"
								(ngModelChange)="patch({ domain: $event })"
							/>
							@if (shownErrors()['domain']; as error) {
								<p class="error" role="alert" data-test="error-domain">{{ error.key | translate }}</p>
							}
						</div>
					</div>
					<div class="field">
						<label class="label" for="inbox-mailbox-account"
							>{{ 'INBOX.SETTINGS.MAILBOXES.ACCOUNT' | translate }}
							<span class="required" aria-hidden="true">*</span></label
						>
						@if (accountOptions().length) {
							<nb-select
								fullWidth
								size="small"
								id="inbox-mailbox-account"
								data-test="account"
								[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
								[selected]="form().providerAccountId"
								(selectedChange)="patch({ providerAccountId: $event })"
							>
								@for (account of accountOptions(); track account.id) {
									<nb-option [value]="account.id">{{ account.name }}</nb-option>
								}
							</nb-select>
						} @else {
							<p class="hint warn" data-test="no-accounts">
								{{ 'INBOX.SETTINGS.MAILBOXES.NO_RECEIVING_ACCOUNT' | translate }}
							</p>
						}
						@if (shownErrors()['providerAccountId']; as error) {
							<p class="error" role="alert" data-test="error-providerAccountId">
								{{ error.key | translate }}
							</p>
						}
					</div>
				} @else {
					<div class="field">
						<label class="label" for="inbox-mailbox-name">{{
							'INBOX.SETTINGS.MAILBOXES.NAME_PART' | translate
						}}</label>
						<input
							nbInput
							fullWidth
							fieldSize="small"
							id="inbox-mailbox-name"
							data-test="local-part"
							[attr.maxlength]="localPartMax"
							[placeholder]="'INBOX.SETTINGS.MAILBOXES.NAME_PART_PLACEHOLDER' | translate"
							[ngModel]="form().localPart"
							[ngModelOptions]="standalone"
							(ngModelChange)="patch({ localPart: $event })"
						/>
						@if (platformDomain) {
							<p class="hint" data-test="address-preview">
								{{
									'INBOX.SETTINGS.MAILBOXES.ADDRESS_PREVIEW'
										| translate: { name: namePreview(), domain: platformDomain }
								}}
							</p>
						}
						@if (shownErrors()['localPart']; as error) {
							<p class="error" role="alert" data-test="error-localPart">{{ error.key | translate }}</p>
						}
					</div>
					@if (form().kind === forwarding) {
						<div class="field">
							<label class="label" for="inbox-mailbox-forward-from">{{
								'INBOX.SETTINGS.MAILBOXES.FORWARD_FROM' | translate
							}}</label>
							<input
								nbInput
								fullWidth
								fieldSize="small"
								type="email"
								id="inbox-mailbox-forward-from"
								data-test="forward-from"
								maxlength="320"
								[ngModel]="form().forwardFrom"
								[ngModelOptions]="standalone"
								(ngModelChange)="patch({ forwardFrom: $event })"
							/>
							@if (shownErrors()['forwardFrom']; as error) {
								<p class="error" role="alert" data-test="error-forwardFrom">
									{{ error.key | translate }}
								</p>
							}
						</div>
					}
				}

				<div class="field">
					<label class="label" for="inbox-mailbox-display-name">{{
						'INBOX.SETTINGS.MAILBOXES.DISPLAY_NAME' | translate
					}}</label>
					<input
						nbInput
						fullWidth
						fieldSize="small"
						id="inbox-mailbox-display-name"
						data-test="display-name"
						[attr.maxlength]="displayNameMax"
						[ngModel]="form().displayName"
						[ngModelOptions]="standalone"
						(ngModelChange)="patch({ displayName: $event })"
					/>
				</div>

				<div class="field">
					<label class="label" for="inbox-mailbox-allowlist">{{
						'INBOX.SETTINGS.MAILBOXES.ALLOWLIST' | translate
					}}</label>
					<textarea
						nbInput
						fullWidth
						rows="3"
						id="inbox-mailbox-allowlist"
						data-test="allowlist"
						spellcheck="false"
						[placeholder]="'INBOX.SETTINGS.MAILBOXES.ALLOWLIST_PLACEHOLDER' | translate"
						[ngModel]="form().allowlist"
						[ngModelOptions]="standalone"
						(ngModelChange)="patch({ allowlist: $event })"
					></textarea>
					<p class="hint">{{ 'INBOX.SETTINGS.MAILBOXES.ALLOWLIST_HINT' | translate }}</p>
					@if (shownErrors()['allowlist']; as error) {
						<p class="error" role="alert" data-test="error-allowlist">
							{{ error.key | translate: error.params }}
						</p>
					}
				</div>

				<nb-toggle
					data-test="is-default"
					[checked]="form().isDefault"
					(checkedChange)="patch({ isDefault: $event })"
				>
					{{ 'INBOX.SETTINGS.MAILBOXES.MAKE_DEFAULT_ON_CREATE' | translate }}
				</nb-toggle>
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" data-test="cancel" [disabled]="saving()" (click)="cancel()">
					{{ 'INBOX.SETTINGS.CANCEL' | translate }}
				</button>
				<button nbButton status="primary" type="button" data-test="save" [disabled]="saving()" (click)="save()">
					{{ 'INBOX.SETTINGS.MAILBOXES.CREATE' | translate }}
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
			.row {
				display: flex;
				gap: 0.5rem;
				align-items: flex-start;
			}
			.grow {
				flex: 1 1 0;
			}
			.at {
				padding-top: 1.9rem;
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
			.warn {
				color: var(--text-warning-color, #ffaa00);
				opacity: 1;
			}
			.detail {
				opacity: 0.7;
			}
			.footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class InboxMailboxCreateDialogComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly directory = inject(InboxDirectoryService);
	private readonly dialogRef = inject<NbDialogRef<InboxMailboxCreateDialogComponent>>(NbDialogRef);
	private readonly destroyRef = inject(DestroyRef);

	// ---------------------------------------------------------------- set through the dialog's `context`

	organizationId: ID | null = null;
	tenantId: ID | null = null;
	/** The server's platform mailbox domain (`null`: only custom-domain mailboxes). */
	platformDomain: string | null = null;
	/** The organization's and the tenant's provider accounts. */
	accounts: IInboxProviderAccount[] = [];

	// ---------------------------------------------------------------- state

	protected readonly owners = InboxMailboxOwnerTypeEnum;
	protected readonly ownerTypes = Object.values(InboxMailboxOwnerTypeEnum);
	protected readonly kinds = MAILBOX_CREATE_KINDS;
	protected readonly customDomain = InboxMailboxKindEnum.CUSTOM_DOMAIN;
	protected readonly forwarding = InboxMailboxKindEnum.FORWARDING;
	protected readonly localPartMax = MAILBOX_LOCAL_PART_MAX;
	protected readonly displayNameMax = MAILBOX_DISPLAY_NAME_MAX;
	protected readonly standalone = { standalone: true };

	readonly form = signal<IMailboxCreateFormState>(emptyMailboxCreateForm(null));
	readonly submitted = signal(false);
	readonly saving = signal(false);
	readonly apiError = signal<string | null>(null);

	readonly employees = signal<IInboxDirectoryEntry[]>([]);
	readonly employeesState = signal<DirectoryState>('idle');
	readonly teams = signal<IInboxDirectoryEntry[]>([]);
	readonly teamsState = signal<DirectoryState>('idle');

	private readonly accountList = signal<IInboxProviderAccount[]>([]);
	readonly accountOptions = computed(() => receivingAccounts(this.accountList()));
	readonly errors = computed(() => mailboxCreateErrors(this.form(), this.platformDomain));
	readonly shownErrors = computed(() => (this.submitted() ? this.errors() : {}));
	/** The name part of the address preview: the typed one, else the owner's (allocated by the API). */
	readonly namePreview = computed(() => this.form().localPart.trim().toLowerCase() || '…');

	ngOnInit(): void {
		this.form.set(emptyMailboxCreateForm(this.platformDomain));
		this.accountList.set(this.accounts ?? []);
	}

	patch(change: Partial<IMailboxCreateFormState>): void {
		this.form.set({ ...this.form(), ...change });
	}

	/** Another owner: its picker's list is read the first time it is needed. */
	setOwnerType(ownerType: InboxMailboxOwnerTypeEnum): void {
		this.patch({ ownerType, ownerEmployeeId: null, ownerTeamId: null });
		if (ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE) {
			this.loadOnce(this.employeesState, this.employees, () =>
				this.directory.employees(this.organizationId as ID, this.tenantId as ID)
			);
		}
		if (ownerType === InboxMailboxOwnerTypeEnum.TEAM) {
			this.loadOnce(this.teamsState, this.teams, () =>
				this.directory.teams(this.organizationId as ID, this.tenantId as ID)
			);
		}
	}

	private loadOnce(
		state: WritableSignal<DirectoryState>,
		list: WritableSignal<IInboxDirectoryEntry[]>,
		read: () => Observable<IInboxDirectoryEntry[]>
	): void {
		if (state() === 'loading' || state() === 'ready') return;
		if (!this.organizationId || !this.tenantId) {
			state.set('error');
			return;
		}
		state.set('loading');
		read()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (entries) => {
					list.set(entries ?? []);
					state.set('ready');
				},
				error: () => state.set('error')
			});
	}

	save(): void {
		if (this.saving()) return;
		this.submitted.set(true);
		if (Object.keys(this.errors()).length > 0) return;
		this.saving.set(true);
		this.apiError.set(null);
		this.api
			.createMailbox(mailboxCreateInput(this.form(), this.organizationId))
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (mailbox) => {
					this.saving.set(false);
					this.dialogRef.close({ mailbox } satisfies IInboxMailboxCreateDialogResult);
				},
				error: (error: unknown) => {
					this.saving.set(false);
					this.apiError.set(apiErrorMessage(error) ?? 'INBOX.SETTINGS.ERRORS.SAVE');
				}
			});
	}

	cancel(): void {
		this.dialogRef.close();
	}
}
