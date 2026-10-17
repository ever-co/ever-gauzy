import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbCardModule, NbDialogService, NbIconModule, NbSpinnerModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import {
	ID,
	IInboxMailbox,
	IInboxMailboxDomainVerification,
	IInboxOrganizationEmailSettings,
	IInboxProviderAccount,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	IOrganization
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { IInboxDirectoryEntry, InboxDirectoryService } from '../services/inbox-directory.service';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { apiErrorMessage, InboxSettingsView, viewOfLoadError } from './inbox-settings.helpers';
import { IInboxMailboxCreateDialogResult, InboxMailboxCreateDialogComponent } from './mailbox-create-dialog.component';
import { IInboxMailboxEditDialogResult, InboxMailboxEditDialogComponent } from './mailbox-edit-dialog.component';
import { InboxMailboxMembersDialogComponent } from './mailbox-members-dialog.component';
import { agentOfMailbox, domainStatusTone, forwardFromOf, isSharedMailbox } from './mailbox-settings.helpers';
import { InboxOneTimeSecretDialogComponent } from './one-time-secret-dialog.component';

/** A mailbox with what its card shows. */
export interface IInboxMailboxRow {
	mailbox: IInboxMailbox;
	shared: boolean;
	/** The provider account a custom-domain mailbox receives through. */
	account: IInboxProviderAccount | null;
	/** A custom domain's DNS record (`null`: not a custom domain, or not readable). */
	verification: IInboxMailboxDomainVerification | null;
	forwardFrom: string | null;
	/** The Ever Works agent its mail goes to: the stored value, and the agent's name once the agents are read. */
	agentId: string | null;
	agentName: string | null;
}

/**
 * Settings → Inbox → Mailboxes (`/pages/settings/inbox-mailboxes`, plan 04 §5.1, G-P4-1; `INBOX_MAILBOX_MANAGE`): the
 * selected organization's mailboxes, shared (organization, team) and personal (employee).
 *
 * - **Platform addresses** are allocated by the API on the server's platform domain (`GAUZY_INBOX_DOMAIN`, read from
 *   the API — the page names no domain of its own); a server without one creates custom-domain mailboxes only.
 * - **Custom domains**: the DNS TXT record that proves the domain (`_gauzy-inbox.<domain>`) and its status, a "Check
 *   DNS now" action, and the provider account the domain's mail is received through.
 * - **Forwarding**: the platform address the user forwards an existing mailbox to.
 * - **Shared mailboxes**: their members (READER / MANAGER). **Default** mailbox per owner, active / inactive, relay
 *   secret rotation (shown once), the **Ever Works agent** the mail is handed to (G-P4-6).
 * - **Auto-provisioning** (opt-in per organization): a mailbox for every new employee, and "create the missing ones
 *   now" (employees, the default organization mailbox).
 *
 * The page asks the API first: a 404 means the Inbox email features are off on this installation, and the page says so.
 */
@Component({
	selector: 'ngx-inbox-mailboxes-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbToggleModule, TranslatePipe],
	template: `
		<nb-card class="page" data-test="mailboxes-page">
			<nb-card-header class="header">
				<div>
					<h4>{{ 'INBOX.SETTINGS.MAILBOXES.TITLE' | translate }}</h4>
					<p class="subtitle">{{ 'INBOX.SETTINGS.MAILBOXES.SUBTITLE' | translate }}</p>
				</div>
				@if (view() === 'ready') {
					<button nbButton size="small" status="primary" type="button" data-test="add-mailbox" (click)="add()">
						{{ 'INBOX.SETTINGS.MAILBOXES.ADD' | translate }}
					</button>
				}
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

						<section class="section" data-test="platform">
							@if (platformDomain(); as domain) {
								<p data-test="platform-domain">
									{{ 'INBOX.SETTINGS.MAILBOXES.PLATFORM_DOMAIN' | translate: { domain: domain } }}
								</p>
							} @else {
								<p class="warn" data-test="no-platform-domain">
									{{ 'INBOX.SETTINGS.MAILBOXES.NO_PLATFORM_DOMAIN' | translate }}
								</p>
							}
							<div class="provisioning">
								<nb-toggle
									data-test="auto-provision"
									[checked]="!!settings()?.autoProvisionEmployees"
									[disabled]="busy().has('settings') || !platformDomain()"
									(checkedChange)="setAutoProvision($event)"
								>
									{{ 'INBOX.SETTINGS.MAILBOXES.AUTO_PROVISION' | translate }}
								</nb-toggle>
								<button
									nbButton
									size="tiny"
									status="basic"
									type="button"
									data-test="provision-employees"
									[disabled]="busy().has('provision') || !platformDomain()"
									(click)="provision('employees')"
								>
									{{ 'INBOX.SETTINGS.MAILBOXES.PROVISION_EMPLOYEES' | translate }}
								</button>
								<button
									nbButton
									size="tiny"
									status="basic"
									type="button"
									data-test="provision-default"
									[disabled]="busy().has('provision') || !platformDomain()"
									(click)="provision('default')"
								>
									{{ 'INBOX.SETTINGS.MAILBOXES.PROVISION_DEFAULT' | translate }}
								</button>
							</div>
							<p class="hint">{{ 'INBOX.SETTINGS.MAILBOXES.AUTO_PROVISION_HINT' | translate }}</p>
						</section>

						@for (group of groups(); track group.key) {
							<section class="section" [attr.data-test]="'group-' + group.key">
								<h5>{{ 'INBOX.SETTINGS.MAILBOXES.GROUP_' + group.key | translate }}</h5>
								@for (row of group.rows; track row.mailbox.id) {
									<div
										class="mailbox"
										[class.inactive]="row.mailbox.isActive === false"
										[attr.data-test]="'mailbox-' + row.mailbox.id"
									>
										<div class="head">
											<div>
												<div class="address">
													<code>{{ row.mailbox.address }}</code>
													<button
														nbButton
														ghost
														size="tiny"
														type="button"
														[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
														(click)="copy(row.mailbox.address)"
													>
														<nb-icon icon="copy-outline"></nb-icon>
													</button>
												</div>
												<div class="meta">
													@if (row.mailbox.displayName) {
														<span>{{ row.mailbox.displayName }}</span>
													}
													<span class="chip">{{ 'INBOX.SETTINGS.OWNER.' + row.mailbox.ownerType | translate }}</span>
													<span class="chip">{{ 'INBOX.SETTINGS.KIND.' + row.mailbox.kind | translate }}</span>
													@if (row.mailbox.isDefault) {
														<span class="chip chip-primary" [attr.data-test]="'default-' + row.mailbox.id">{{
															'INBOX.SETTINGS.MAILBOXES.IS_DEFAULT' | translate
														}}</span>
													}
													@if (row.mailbox.isActive === false) {
														<span class="chip" [attr.data-test]="'inactive-' + row.mailbox.id">{{
															'INBOX.SETTINGS.MAILBOXES.INACTIVE' | translate
														}}</span>
													}
													@if (row.mailbox.autoProvisioned) {
														<span class="chip">{{ 'INBOX.SETTINGS.MAILBOXES.AUTO' | translate }}</span>
													}
												</div>
											</div>
											<div class="actions">
												<button
													nbButton
													size="tiny"
													status="basic"
													type="button"
													[attr.data-test]="'edit-' + row.mailbox.id"
													[disabled]="isBusy(row)"
													(click)="edit(row)"
												>
													{{ 'INBOX.SETTINGS.EDIT' | translate }}
												</button>
												@if (row.shared) {
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														[attr.data-test]="'members-' + row.mailbox.id"
														[disabled]="isBusy(row)"
														(click)="members(row)"
													>
														{{ 'INBOX.SETTINGS.MAILBOXES.MEMBERS' | translate }}
													</button>
												}
												@if (!row.mailbox.isDefault) {
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														[attr.data-test]="'make-default-' + row.mailbox.id"
														[disabled]="isBusy(row)"
														(click)="makeDefault(row)"
													>
														{{ 'INBOX.SETTINGS.MAILBOXES.MAKE_DEFAULT' | translate }}
													</button>
												}
												<button
													nbButton
													size="tiny"
													status="basic"
													type="button"
													[attr.data-test]="'active-' + row.mailbox.id"
													[disabled]="isBusy(row)"
													(click)="setActive(row, row.mailbox.isActive === false)"
												>
													{{
														(row.mailbox.isActive === false
															? 'INBOX.SETTINGS.MAILBOXES.ACTIVATE'
															: 'INBOX.SETTINGS.MAILBOXES.DEACTIVATE'
														) | translate
													}}
												</button>
												<button
													nbButton
													size="tiny"
													ghost
													status="basic"
													type="button"
													[attr.data-test]="'rotate-' + row.mailbox.id"
													[disabled]="isBusy(row)"
													(click)="confirmRotate.set(row.mailbox.id ?? null)"
												>
													{{ 'INBOX.SETTINGS.MAILBOXES.ROTATE_SECRET' | translate }}
												</button>
											</div>
										</div>

										@if (confirmRotate() === row.mailbox.id) {
											<div class="confirm" role="alertdialog" [attr.data-test]="'confirm-rotate-' + row.mailbox.id">
												<span>{{ 'INBOX.SETTINGS.MAILBOXES.ROTATE_CONFIRM' | translate }}</span>
												<button
													nbButton
													size="tiny"
													status="warning"
													type="button"
													[attr.data-test]="'confirm-rotate-yes-' + row.mailbox.id"
													[disabled]="isBusy(row)"
													(click)="rotateSecret(row)"
												>
													{{ 'INBOX.SETTINGS.MAILBOXES.ROTATE_SECRET' | translate }}
												</button>
												<button nbButton size="tiny" ghost type="button" (click)="confirmRotate.set(null)">
													{{ 'INBOX.SETTINGS.CANCEL' | translate }}
												</button>
											</div>
										}

										<dl class="details">
											@if (row.mailbox.kind === kinds.CUSTOM_DOMAIN) {
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.DOMAIN_STATUS' | translate }}</dt>
												<dd>
													<span
														class="chip"
														[class.chip-success]="tone(row) === 'success'"
														[class.chip-danger]="tone(row) === 'danger'"
														[class.chip-warning]="tone(row) === 'warning'"
														[attr.data-test]="'domain-status-' + row.mailbox.id"
														>{{
															'INBOX.SETTINGS.DOMAIN_STATUS.' + (row.mailbox.domainStatus ?? statuses.PENDING)
																| translate
														}}</span
													>
													<button
														nbButton
														size="tiny"
														status="basic"
														type="button"
														[attr.data-test]="'check-dns-' + row.mailbox.id"
														[disabled]="isBusy(row)"
														(click)="verify(row)"
													>
														{{ 'INBOX.SETTINGS.MAILBOXES.CHECK_DNS' | translate }}
													</button>
													<p class="hint">
														{{ 'INBOX.SETTINGS.DOMAIN_STATUS_HINT.' + (row.mailbox.domainStatus ?? statuses.PENDING) | translate }}
													</p>
												</dd>
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.DNS_RECORDS' | translate }}</dt>
												<dd>
													@if (row.verification; as record) {
														<table class="dns" [attr.data-test]="'dns-' + row.mailbox.id">
															<thead>
																<tr>
																	<th>{{ 'INBOX.SETTINGS.MAILBOXES.DNS_TYPE' | translate }}</th>
																	<th>{{ 'INBOX.SETTINGS.MAILBOXES.DNS_NAME' | translate }}</th>
																	<th>{{ 'INBOX.SETTINGS.MAILBOXES.DNS_VALUE' | translate }}</th>
																</tr>
															</thead>
															<tbody>
																<tr>
																	<td>{{ record.recordType }}</td>
																	<td>
																		<code>{{ record.recordName }}</code>
																		<button
																			nbButton
																			ghost
																			size="tiny"
																			type="button"
																			[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
																			(click)="copy(record.recordName)"
																		>
																			<nb-icon icon="copy-outline"></nb-icon>
																		</button>
																	</td>
																	<td>
																		<code>{{ record.recordValue }}</code>
																		<button
																			nbButton
																			ghost
																			size="tiny"
																			type="button"
																			[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
																			(click)="copy(record.recordValue)"
																		>
																			<nb-icon icon="copy-outline"></nb-icon>
																		</button>
																	</td>
																</tr>
																<tr>
																	<td>MX</td>
																	<td>
																		<code>{{ row.mailbox.domain }}</code>
																	</td>
																	<td class="hint">
																		{{
																			'INBOX.SETTINGS.MAILBOXES.MX_HINT'
																				| translate: { account: row.account?.name ?? '' }
																		}}
																	</td>
																</tr>
															</tbody>
														</table>
													} @else {
														<span class="hint" [attr.data-test]="'dns-unavailable-' + row.mailbox.id">{{
															'INBOX.SETTINGS.MAILBOXES.DNS_UNAVAILABLE' | translate
														}}</span>
													}
												</dd>
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.ACCOUNT' | translate }}</dt>
												<dd>{{ row.account?.name ?? ('INBOX.SETTINGS.MAILBOXES.ACCOUNT_MISSING' | translate) }}</dd>
											}
											@if (row.mailbox.kind === kinds.FORWARDING || row.mailbox.kind === kinds.PLATFORM) {
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.FORWARDING' | translate }}</dt>
												<dd [attr.data-test]="'forwarding-' + row.mailbox.id">
													@if (row.forwardFrom) {
														{{
															'INBOX.SETTINGS.MAILBOXES.FORWARD_FROM_TO'
																| translate: { from: row.forwardFrom, to: row.mailbox.address }
														}}
													} @else {
														{{ 'INBOX.SETTINGS.MAILBOXES.FORWARD_TO' | translate: { to: row.mailbox.address } }}
													}
												</dd>
											}
											@if (row.mailbox.senderAllowlist?.length) {
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.ALLOWLIST' | translate }}</dt>
												<dd>{{ row.mailbox.senderAllowlist?.join(', ') }}</dd>
											}
											@if (row.agentId) {
												<dt>{{ 'INBOX.SETTINGS.MAILBOXES.AGENT' | translate }}</dt>
												<dd [attr.data-test]="'agent-' + row.mailbox.id">{{ row.agentName ?? row.agentId }}</dd>
											}
											<dt>{{ 'INBOX.SETTINGS.MAILBOXES.MESSAGES' | translate }}</dt>
											<dd>
												{{ row.mailbox.messageCount ?? 0 }}
												@if (row.mailbox.lastMessageAt) {
													· {{ 'INBOX.SETTINGS.MAILBOXES.LAST_MESSAGE' | translate }}
													{{ row.mailbox.lastMessageAt | date: 'medium' }}
												}
											</dd>
										</dl>
									</div>
								} @empty {
									<p class="hint" [attr.data-test]="'empty-' + group.key">
										{{ 'INBOX.SETTINGS.MAILBOXES.EMPTY_' + group.key | translate }}
									</p>
								}
							</section>
						}
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				gap: 1rem;
			}
			.header h4 {
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
			}
			.section {
				margin-bottom: 1.5rem;
			}
			.provisioning {
				display: flex;
				flex-wrap: wrap;
				gap: 0.75rem;
				align-items: center;
			}
			.mailbox {
				padding: 0.75rem 1rem;
				margin-bottom: 0.75rem;
				border: 1px solid var(--border-basic-color-4, #e4e9f2);
				border-radius: 0.5rem;
			}
			.mailbox.inactive {
				opacity: 0.7;
			}
			.head {
				display: flex;
				justify-content: space-between;
				gap: 1rem;
				flex-wrap: wrap;
			}
			.address code {
				font-size: 0.95rem;
				font-weight: 600;
			}
			.meta,
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
			.chip-warning {
				border-color: var(--color-warning-default, #ffaa00);
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
				gap: 0.35rem 1rem;
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
			.dns {
				border-collapse: collapse;
				font-size: 0.8rem;
			}
			.dns th,
			.dns td {
				padding: 0.2rem 0.5rem;
				border: 1px solid var(--border-basic-color-3, #edf1f7);
				text-align: left;
				vertical-align: top;
			}
			.loading {
				min-height: 8rem;
			}
		`
	]
})
export class InboxMailboxesPageComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly directory = inject(InboxDirectoryService);
	private readonly store = inject(Store);
	private readonly dialogs = inject(NbDialogService);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly kinds = InboxMailboxKindEnum;
	protected readonly statuses = InboxMailboxDomainStatusEnum;

	readonly view = signal<InboxSettingsView>('loading');
	readonly mailboxes = signal<IInboxMailbox[]>([]);
	readonly settings = signal<IInboxOrganizationEmailSettings | null>(null);
	readonly accounts = signal<IInboxProviderAccount[]>([]);
	readonly verifications = signal<Record<string, IInboxMailboxDomainVerification | null>>({});
	readonly agents = signal<IInboxDirectoryEntry[]>([]);
	readonly organization = signal<{ id: ID; tenantId: ID | null } | null>(null);
	/** Mailboxes (by id) and page actions (`settings`, `provision`) in flight. */
	readonly busy = signal<ReadonlySet<string>>(new Set());
	readonly confirmRotate = signal<string | null>(null);
	readonly actionError = signal<string | null>(null);

	readonly platformDomain = computed(() => this.settings()?.platformDomain ?? null);

	readonly rows = computed<IInboxMailboxRow[]>(() => {
		const accounts = new Map(this.accounts().map((account) => [account.id, account]));
		const agents = new Map(this.agents().map((agent) => [agent.id, agent.name]));
		const verifications = this.verifications();
		return this.mailboxes().map((mailbox) => {
			const agentId = agentOfMailbox(mailbox);
			return {
				mailbox,
				shared: isSharedMailbox(mailbox),
				account: mailbox.providerAccountId ? (accounts.get(mailbox.providerAccountId) ?? null) : null,
				verification: verifications[mailbox.id ?? ''] ?? null,
				forwardFrom: forwardFromOf(mailbox),
				agentId,
				agentName: agentId ? (agents.get(agentId) ?? null) : null
			};
		});
	});

	/** Shared mailboxes first (the organization's and the teams'), then the employees' own. */
	readonly groups = computed(() => {
		const rows = this.rows();
		return [
			{ key: 'SHARED', rows: rows.filter((row) => row.shared) },
			{ key: 'PERSONAL', rows: rows.filter((row) => !row.shared) }
		];
	});

	private readonly load$ = new Subject<void>();

	ngOnInit(): void {
		this.load$
			.pipe(
				switchMap(() => {
					this.view.set('loading');
					const organizationId = this.organization()?.id ?? null;
					return forkJoin({
						mailboxes: this.api.mailboxes(organizationId),
						settings: this.api.emailSettings(organizationId),
						// The accounts only name the receiving account of a custom domain: the page works without them.
						accounts: this.api.accounts(organizationId).pipe(catchError(() => of([] as IInboxProviderAccount[])))
					}).pipe(
						catchError((error: unknown) => {
							this.view.set(viewOfLoadError(error));
							return EMPTY;
						})
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ mailboxes, settings, accounts }) => {
				this.mailboxes.set(mailboxes ?? []);
				this.settings.set(settings ?? null);
				this.accounts.set(accounts ?? []);
				this.confirmRotate.set(null);
				this.view.set('ready');
				this.readVerifications(mailboxes ?? []);
				this.readAgents(mailboxes ?? []);
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization | null | undefined) => !!organization?.id),
				map((organization: IOrganization) => ({
					id: organization.id as ID,
					tenantId: (organization.tenantId as ID) ?? null
				})),
				distinctUntilChanged((a, b) => a.id === b.id),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((organization) => {
				this.organization.set(organization);
				this.reload();
			});
	}

	reload(): void {
		this.actionError.set(null);
		this.load$.next();
	}

	private tenantId(): ID | null {
		return this.organization()?.tenantId ?? (this.store.user?.tenantId as ID) ?? null;
	}

	/** The DNS record of each custom-domain mailbox (one request each; a failure leaves that one unknown). */
	private readVerifications(mailboxes: IInboxMailbox[]): void {
		const organizationId = this.organization()?.id ?? null;
		const custom = mailboxes.filter((mailbox) => mailbox.kind === InboxMailboxKindEnum.CUSTOM_DOMAIN && !!mailbox.id);
		if (custom.length === 0) {
			this.verifications.set({});
			return;
		}
		forkJoin(
			custom.map((mailbox) =>
				this.api.mailboxVerification(mailbox.id as ID, organizationId).pipe(
					map((record) => [mailbox.id as string, record] as const),
					catchError(() => of([mailbox.id as string, null] as const))
				)
			)
		)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((entries) => this.verifications.set(Object.fromEntries(entries)));
	}

	/** The names of the Ever Works agents the mailboxes are routed to (only read when one is). */
	private readAgents(mailboxes: IInboxMailbox[]): void {
		const organizationId = this.organization()?.id;
		const tenantId = this.tenantId();
		if (!organizationId || !tenantId || !mailboxes.some((mailbox) => !!agentOfMailbox(mailbox))) return;
		this.directory
			.everWorksAgents(organizationId, tenantId)
			.pipe(
				catchError(() => of([] as IInboxDirectoryEntry[])),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((agents) => this.agents.set(agents));
	}

	isBusy(row: IInboxMailboxRow): boolean {
		return this.busy().has(row.mailbox.id ?? '');
	}

	tone(row: IInboxMailboxRow): 'success' | 'warning' | 'danger' {
		return domainStatusTone(row.mailbox.domainStatus);
	}

	private setBusy(key: string, on: boolean): void {
		const next = new Set(this.busy());
		if (on) next.add(key);
		else next.delete(key);
		this.busy.set(next);
	}

	/** Runs one action: busy while in flight, the API's refusal shown on the page. */
	private run<T>(key: string, request$: Observable<T>, done: (result: T) => void): void {
		if (this.busy().has(key)) return;
		this.setBusy(key, true);
		this.actionError.set(null);
		request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (result) => {
				this.setBusy(key, false);
				done(result);
			},
			error: (error: unknown) => {
				this.setBusy(key, false);
				this.actionError.set(apiErrorMessage(error) ?? 'INBOX.SETTINGS.ERRORS.ACTION');
			}
		});
	}

	private replace(mailbox: IInboxMailbox): void {
		this.mailboxes.set(this.mailboxes().map((entry) => (entry.id === mailbox.id ? mailbox : entry)));
	}

	// ---------------------------------------------------------------- page actions

	setAutoProvision(on: boolean): void {
		this.run('settings', this.api.updateEmailSettings(!!on, this.organization()?.id), (settings) => {
			this.settings.set({ ...settings, platformDomain: settings?.platformDomain ?? this.platformDomain() });
			this.toastr.success('INBOX.SETTINGS.TOAST.SAVED');
		});
	}

	provision(what: 'employees' | 'default'): void {
		const organizationId = this.organization()?.id;
		this.run(
			'provision',
			this.api.provision({
				...(organizationId ? { organizationId } : {}),
				...(what === 'employees' ? { employees: true } : { defaultOrganizationMailbox: true })
			}),
			(result) => {
				const created = result?.created?.length ?? 0;
				if (created > 0) {
					this.toastr.success('INBOX.SETTINGS.MAILBOXES.PROVISIONED', { count: created });
					this.reload();
				} else {
					this.toastr.success('INBOX.SETTINGS.MAILBOXES.NOTHING_TO_PROVISION');
				}
			}
		);
	}

	add(): void {
		this.actionError.set(null);
		this.dialogs
			.open(InboxMailboxCreateDialogComponent, {
				context: {
					organizationId: this.organization()?.id ?? null,
					tenantId: this.tenantId(),
					platformDomain: this.platformDomain(),
					accounts: this.accounts()
				},
				closeOnBackdropClick: false
			})
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result?: IInboxMailboxCreateDialogResult) => {
				if (!result?.mailbox) return;
				this.toastr.success('INBOX.SETTINGS.TOAST.ADDED');
				// A new default takes the flag from the owner's previous one: read the list again.
				this.reload();
			});
	}

	// ---------------------------------------------------------------- mailbox actions

	edit(row: IInboxMailboxRow): void {
		if (this.isBusy(row)) return;
		this.actionError.set(null);
		this.dialogs
			.open(InboxMailboxEditDialogComponent, {
				context: {
					mailbox: row.mailbox,
					organizationId: this.organization()?.id ?? null,
					tenantId: this.tenantId(),
					accounts: this.accounts()
				},
				closeOnBackdropClick: false
			})
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result?: IInboxMailboxEditDialogResult) => {
				if (!result?.mailbox) return;
				this.toastr.success('INBOX.SETTINGS.TOAST.SAVED');
				this.reload();
			});
	}

	members(row: IInboxMailboxRow): void {
		if (!row.shared || this.isBusy(row)) return;
		this.dialogs
			.open(InboxMailboxMembersDialogComponent, {
				context: {
					mailbox: row.mailbox,
					organizationId: this.organization()?.id ?? null,
					tenantId: this.tenantId()
				},
				closeOnBackdropClick: false
			})
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result?: { members?: unknown[] }) => {
				if (result?.members) this.toastr.success('INBOX.SETTINGS.TOAST.SAVED');
			});
	}

	makeDefault(row: IInboxMailboxRow): void {
		const id = row.mailbox.id;
		if (!id) return;
		// The owner's previous default lost the flag: read the list again.
		this.run(id, this.api.updateMailbox(id, { isDefault: true }, this.organization()?.id), () => this.reload());
	}

	setActive(row: IInboxMailboxRow, isActive: boolean): void {
		const id = row.mailbox.id;
		if (!id) return;
		this.run(id, this.api.updateMailbox(id, { isActive }, this.organization()?.id), (mailbox) => this.replace(mailbox));
	}

	/**
	 * Checks the domain's TXT record now. A missing record is an answer, not a failure: the status stays PENDING (or turns
	 * FAILED for a domain that was verified) and the API says why.
	 */
	verify(row: IInboxMailboxRow): void {
		const id = row.mailbox.id;
		if (!id) return;
		this.run(id, this.api.verifyMailbox(id, this.organization()?.id), (record) => {
			this.verifications.set({ ...this.verifications(), [id]: record });
			this.replace({ ...row.mailbox, domainStatus: record.status });
			if (record.status === InboxMailboxDomainStatusEnum.VERIFIED) {
				this.toastr.success('INBOX.SETTINGS.MAILBOXES.DOMAIN_VERIFIED');
			} else {
				this.toastr.warning(record.message || 'INBOX.SETTINGS.MAILBOXES.DOMAIN_NOT_VERIFIED');
			}
		});
	}

	/** A new relay secret: the previous one stops working at once; the new one is shown once. */
	rotateSecret(row: IInboxMailboxRow): void {
		const id = row.mailbox.id;
		this.confirmRotate.set(null);
		if (!id) return;
		this.run(id, this.api.rotateMailboxSecret(id, this.organization()?.id), (secret) => {
			this.dialogs.open(InboxOneTimeSecretDialogComponent, {
				context: {
					values: [
						{ label: 'INBOX.SETTINGS.MAILBOXES.ADDRESS', translate: true, value: secret.address },
						{ label: 'INBOX.SETTINGS.MAILBOXES.RELAY_SECRET', translate: true, value: secret.inboundSecret }
					],
					hint: 'INBOX.SETTINGS.ONE_TIME.MAILBOX_HINT'
				},
				closeOnEsc: false,
				closeOnBackdropClick: false
			});
		});
	}

	async copy(value: string | null | undefined): Promise<void> {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			this.toastr.success('INBOX.SETTINGS.TOAST.COPIED');
		} catch {
			// No clipboard permission: the value is still selectable on screen.
		}
	}
}
