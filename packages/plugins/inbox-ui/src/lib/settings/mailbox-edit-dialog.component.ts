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
import { ID, IInboxMailbox, IInboxProviderAccount, InboxMailboxKindEnum } from '@gauzy/contracts';
import { IInboxDirectoryEntry, InboxDirectoryService } from '../services/inbox-directory.service';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { apiErrorMessage } from './inbox-settings.helpers';
import {
	agentOfMailbox,
	IMailboxEditFormState,
	IMailboxFormError,
	MAILBOX_DISPLAY_NAME_MAX,
	mailboxEditErrors,
	mailboxEditForm,
	mailboxUpdateInput,
	receivingAccounts
} from './mailbox-settings.helpers';

/** What the dialog closes with after a save (nothing when cancelled or unchanged). */
export interface IInboxMailboxEditDialogResult {
	mailbox: IInboxMailbox;
}

/**
 * "Edit mailbox" (Settings → Inbox → Mailboxes): its display name, sender allowlist, the provider account a
 * custom-domain mailbox receives through, whether it is its owner's default, and the **Ever Works agent** its mail is
 * handed to (G-P4-6: `settings.everWorksAgentId`, merged into the mailbox's other settings). Only what changed is sent.
 *
 * The agents listed are the organization's agent employees whose agent profile comes from Ever Works; the stored value
 * is the agent employee's id (the integration resolves it to the Ever Works agent). A value stored as an Ever Works id
 * stays selectable as it is.
 */
@Component({
	selector: 'ngx-inbox-mailbox-edit-dialog',
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
		<nb-card class="dialog" data-test="mailbox-edit-dialog" [nbSpinner]="saving()">
			<nb-card-header>{{ 'INBOX.SETTINGS.MAILBOXES.EDIT_TITLE' | translate: { address: mailbox?.address } }}</nb-card-header>
			<nb-card-body>
				@if (apiError(); as message) {
					<nb-alert status="danger" role="alert" data-test="dialog-error">{{ message | translate }}</nb-alert>
				}

				<div class="field">
					<label class="label" for="inbox-mailbox-edit-name">{{
						'INBOX.SETTINGS.MAILBOXES.DISPLAY_NAME' | translate
					}}</label>
					<input
						nbInput
						fullWidth
						fieldSize="small"
						id="inbox-mailbox-edit-name"
						data-test="display-name"
						[attr.maxlength]="displayNameMax"
						[ngModel]="form().displayName"
						[ngModelOptions]="standalone"
						(ngModelChange)="patch({ displayName: $event })"
					/>
				</div>

				@if (isCustomDomain()) {
					<div class="field">
						<label class="label" for="inbox-mailbox-edit-account"
							>{{ 'INBOX.SETTINGS.MAILBOXES.ACCOUNT' | translate }}
							<span class="required" aria-hidden="true">*</span></label
						>
						<nb-select
							fullWidth
							size="small"
							id="inbox-mailbox-edit-account"
							data-test="account"
							[placeholder]="'INBOX.SETTINGS.FORM.CHOOSE' | translate"
							[selected]="form().providerAccountId"
							(selectedChange)="patch({ providerAccountId: $event })"
						>
							@for (account of accountOptions(); track account.id) {
								<nb-option [value]="account.id">{{ account.name }}</nb-option>
							}
						</nb-select>
						@if (shownErrors()['providerAccountId']; as error) {
							<p class="error" role="alert" data-test="error-providerAccountId">
								{{ error.key | translate }}
							</p>
						}
					</div>
				}

				<div class="field">
					<label class="label" for="inbox-mailbox-edit-allowlist">{{
						'INBOX.SETTINGS.MAILBOXES.ALLOWLIST' | translate
					}}</label>
					<textarea
						nbInput
						fullWidth
						rows="3"
						id="inbox-mailbox-edit-allowlist"
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

				<div class="field">
					<nb-toggle data-test="is-default" [checked]="form().isDefault" (checkedChange)="patch({ isDefault: $event })">
						{{ 'INBOX.SETTINGS.MAILBOXES.IS_DEFAULT_TOGGLE' | translate }}
					</nb-toggle>
				</div>

				<h6 class="section">{{ 'INBOX.SETTINGS.MAILBOXES.AGENT_TITLE' | translate }}</h6>
				<div class="field">
					<label class="label" for="inbox-mailbox-edit-agent">{{
						'INBOX.SETTINGS.MAILBOXES.AGENT' | translate
					}}</label>
					<nb-select
						fullWidth
						size="small"
						id="inbox-mailbox-edit-agent"
						data-test="agent"
						[disabled]="agentsState() === 'loading'"
						[selected]="form().everWorksAgentId"
						(selectedChange)="patch({ everWorksAgentId: $event })"
					>
						<nb-option [value]="null">{{ 'INBOX.SETTINGS.MAILBOXES.NO_AGENT' | translate }}</nb-option>
						@for (agent of agentOptions(); track agent.id) {
							<nb-option [value]="agent.id"
								>{{ agent.name }}
								@if (agent.detail) {
									<span class="detail">({{ agent.detail }})</span>
								}</nb-option
							>
						}
					</nb-select>
					<p class="hint">{{ 'INBOX.SETTINGS.MAILBOXES.AGENT_HINT' | translate }}</p>
					@if (agentsState() === 'error') {
						<p class="hint warn" data-test="agents-error">
							{{ 'INBOX.SETTINGS.MAILBOXES.AGENTS_UNAVAILABLE' | translate }}
						</p>
					} @else if (agentsState() === 'ready' && agents().length === 0) {
						<p class="hint" data-test="no-agents">{{ 'INBOX.SETTINGS.MAILBOXES.NO_AGENTS' | translate }}</p>
					}
					<p class="hint" data-test="agent-mirror-hint">
						{{ 'INBOX.SETTINGS.MAILBOXES.AGENT_MIRROR_HINT' | translate }}
					</p>
				</div>
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" data-test="cancel" [disabled]="saving()" (click)="cancel()">
					{{ 'INBOX.SETTINGS.CANCEL' | translate }}
				</button>
				<button nbButton status="primary" type="button" data-test="save" [disabled]="saving()" (click)="save()">
					{{ 'INBOX.SETTINGS.SAVE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.dialog {
				width: 38rem;
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
			.section {
				margin: 1rem 0 0.5rem;
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
export class InboxMailboxEditDialogComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly directory = inject(InboxDirectoryService);
	private readonly dialogRef = inject<NbDialogRef<InboxMailboxEditDialogComponent>>(NbDialogRef);
	private readonly destroyRef = inject(DestroyRef);

	// ---------------------------------------------------------------- set through the dialog's `context`

	mailbox: IInboxMailbox | null = null;
	organizationId: ID | null = null;
	tenantId: ID | null = null;
	accounts: IInboxProviderAccount[] = [];

	// ---------------------------------------------------------------- state

	protected readonly displayNameMax = MAILBOX_DISPLAY_NAME_MAX;
	protected readonly standalone = { standalone: true };

	readonly form = signal<IMailboxEditFormState>({
		displayName: '',
		allowlist: '',
		providerAccountId: null,
		isDefault: false,
		everWorksAgentId: null
	});
	readonly submitted = signal(false);
	readonly saving = signal(false);
	readonly apiError = signal<string | null>(null);
	readonly agents = signal<IInboxDirectoryEntry[]>([]);
	readonly agentsState = signal<'loading' | 'ready' | 'error'>('loading');

	private readonly accountList = signal<IInboxProviderAccount[]>([]);
	private readonly storedAgent = signal<string | null>(null);

	readonly isCustomDomain = computed(() => this.mailbox?.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN);
	/** Receiving accounts, plus the mailbox's own account when it is no longer one (so the select shows it). */
	readonly accountOptions = computed(() => {
		const options = receivingAccounts(this.accountList());
		const own = this.accountList().find((account) => account.id === this.mailbox?.providerAccountId);
		return own && !options.includes(own) ? [own, ...options] : options;
	});
	/** The Ever Works agents, plus the stored value when it is not one of them (an Ever Works id, a removed agent). */
	readonly agentOptions = computed(() => {
		const agents = this.agents();
		const stored = this.storedAgent();
		return stored && !agents.some((agent) => agent.id === stored)
			? [{ id: stored, name: stored, detail: null } as IInboxDirectoryEntry, ...agents]
			: agents;
	});
	readonly errors = computed(() =>
		this.mailbox ? mailboxEditErrors(this.form(), this.mailbox) : ({} as Record<string, IMailboxFormError>)
	);
	readonly shownErrors = computed(() => (this.submitted() ? this.errors() : {}));

	ngOnInit(): void {
		this.accountList.set(this.accounts ?? []);
		if (!this.mailbox) return;
		this.form.set(mailboxEditForm(this.mailbox));
		this.storedAgent.set(agentOfMailbox(this.mailbox));
		if (!this.organizationId || !this.tenantId) {
			this.agentsState.set('error');
			return;
		}
		this.directory
			.everWorksAgents(this.organizationId, this.tenantId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (agents) => {
					this.agents.set(agents ?? []);
					this.agentsState.set('ready');
				},
				error: () => this.agentsState.set('error')
			});
	}

	patch(change: Partial<IMailboxEditFormState>): void {
		this.form.set({ ...this.form(), ...change });
	}

	save(): void {
		const mailbox = this.mailbox;
		if (this.saving() || !mailbox?.id) return;
		this.submitted.set(true);
		if (Object.keys(this.errors()).length > 0) return;
		const input = mailboxUpdateInput(this.form(), mailbox);
		if (Object.keys(input).length === 0) {
			this.dialogRef.close();
			return;
		}
		this.saving.set(true);
		this.apiError.set(null);
		this.api
			.updateMailbox(mailbox.id as ID, input, this.organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (saved) => {
					this.saving.set(false);
					this.dialogRef.close({ mailbox: saved } satisfies IInboxMailboxEditDialogResult);
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
