import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogRef,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { ID, IInboxMailbox, IInboxMailboxMember, InboxMailboxMemberRoleEnum } from '@gauzy/contracts';
import { IInboxDirectoryEntry, InboxDirectoryService } from '../services/inbox-directory.service';
import { InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { apiErrorMessage, InboxSettingsView, viewOfLoadError } from './inbox-settings.helpers';

/** One user of the organization with their membership of the mailbox. */
export interface IInboxMemberRow {
	user: IInboxDirectoryEntry;
	member: boolean;
	role: InboxMailboxMemberRoleEnum;
}

/** What the dialog closes with after a save (nothing when cancelled). */
export interface IInboxMailboxMembersDialogResult {
	members: IInboxMailboxMember[];
}

/**
 * The members of a shared (organization or team) mailbox (Settings → Inbox → Mailboxes): the organization's users,
 * each a member or not, as a READER (receives the mail) or a MANAGER (also releases quarantined mail and reads the raw
 * message). Saving replaces the member list. Without members, a team mailbox reaches the team's members and an
 * organization mailbox the users who may manage mailboxes (the API's delivery rules).
 */
@Component({
	selector: 'ngx-inbox-mailbox-members-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslatePipe
	],
	template: `
		<nb-card class="dialog" data-test="members-dialog" [nbSpinner]="view() === 'loading' || saving()">
			<nb-card-header>{{
				'INBOX.SETTINGS.MEMBERS.TITLE' | translate: { address: mailbox?.address }
			}}</nb-card-header>
			<nb-card-body>
				<p class="hint">{{ 'INBOX.SETTINGS.MEMBERS.HINT' | translate }}</p>
				@if (apiError(); as message) {
					<nb-alert status="danger" role="alert" data-test="dialog-error">{{ message | translate }}</nb-alert>
				}
				@switch (view()) {
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="members-load-error">{{
							'INBOX.SETTINGS.MEMBERS.LOAD_ERROR' | translate
						}}</nb-alert>
					}
					@case ('forbidden') {
						<nb-alert status="warning" role="alert" data-test="members-forbidden">{{
							'INBOX.SETTINGS.MEMBERS.USERS_FORBIDDEN' | translate
						}}</nb-alert>
					}
					@case ('ready') {
						<input
							nbInput
							fullWidth
							fieldSize="small"
							type="search"
							data-test="members-filter"
							[placeholder]="'INBOX.FILTERS.SEARCH' | translate"
							[ngModel]="filter()"
							[ngModelOptions]="standalone"
							(ngModelChange)="filter.set($event)"
						/>
						<ul class="members">
							@for (row of visibleRows(); track row.user.id) {
								<li class="member" [attr.data-test]="'member-' + row.user.id">
									<nb-checkbox [checked]="row.member" (checkedChange)="setMember(row, $event)">
										{{ row.user.name }}
										@if (row.user.detail) {
											<span class="detail">{{ row.user.detail }}</span>
										}
									</nb-checkbox>
									<nb-select
										size="tiny"
										[attr.data-test]="'role-' + row.user.id"
										[disabled]="!row.member"
										[selected]="row.role"
										(selectedChange)="setRole(row, $event)"
									>
										@for (role of roles; track role) {
											<nb-option [value]="role">{{
												'INBOX.SETTINGS.MEMBERS.ROLE.' + role | translate
											}}</nb-option>
										}
									</nb-select>
								</li>
							} @empty {
								<li class="hint" data-test="no-users">
									{{ 'INBOX.SETTINGS.MEMBERS.NO_USERS' | translate }}
								</li>
							}
						</ul>
						<p class="hint" data-test="member-count">
							{{ 'INBOX.SETTINGS.MEMBERS.COUNT' | translate: { count: memberCount() } }}
						</p>
					}
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
					[disabled]="saving() || view() !== 'ready'"
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
				width: 36rem;
				max-width: 94vw;
				max-height: 90vh;
			}
			nb-card-body {
				overflow: auto;
			}
			.members {
				list-style: none;
				padding: 0;
				margin: 0.75rem 0 0;
				max-height: 50vh;
				overflow: auto;
			}
			.member {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 0.5rem;
				padding: 0.25rem 0;
			}
			.detail {
				margin-left: 0.35rem;
				opacity: 0.7;
				font-size: 0.8rem;
			}
			.hint {
				margin: 0.25rem 0 0;
				font-size: 0.8rem;
				opacity: 0.75;
			}
			.footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
		`
	]
})
export class InboxMailboxMembersDialogComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly directory = inject(InboxDirectoryService);
	private readonly dialogRef = inject<NbDialogRef<InboxMailboxMembersDialogComponent>>(NbDialogRef);
	private readonly destroyRef = inject(DestroyRef);

	// ---------------------------------------------------------------- set through the dialog's `context`

	mailbox: IInboxMailbox | null = null;
	organizationId: ID | null = null;
	tenantId: ID | null = null;

	// ---------------------------------------------------------------- state

	protected readonly roles = Object.values(InboxMailboxMemberRoleEnum);
	protected readonly standalone = { standalone: true };

	readonly view = signal<InboxSettingsView>('loading');
	readonly rows = signal<IInboxMemberRow[]>([]);
	readonly filter = signal('');
	readonly saving = signal(false);
	readonly apiError = signal<string | null>(null);

	readonly visibleRows = computed(() => {
		const text = this.filter().trim().toLowerCase();
		const rows = this.rows();
		return text
			? rows.filter(
					(row) =>
						row.user.name.toLowerCase().includes(text) ||
						(row.user.detail ?? '').toLowerCase().includes(text)
				)
			: rows;
	});
	readonly memberCount = computed(() => this.rows().filter((row) => row.member).length);

	ngOnInit(): void {
		const mailboxId = this.mailbox?.id;
		if (!mailboxId || !this.organizationId || !this.tenantId) {
			this.view.set('error');
			return;
		}
		forkJoin({
			members: this.api.members(mailboxId as ID, this.organizationId),
			users: this.directory.users(this.organizationId, this.tenantId)
		})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ members, users }) => {
					const roles = new Map((members ?? []).map((member) => [member.userId, member.role]));
					const rows: IInboxMemberRow[] = (users ?? []).map((user) => ({
						user,
						member: roles.has(user.id),
						role: roles.get(user.id) ?? InboxMailboxMemberRoleEnum.READER
					}));
					// A member who is no user of the organization any more stays listed until the list is saved.
					for (const [userId, role] of roles) {
						if (!rows.some((row) => row.user.id === userId)) {
							rows.push({ user: { id: userId, name: userId }, member: true, role });
						}
					}
					this.rows.set(rows);
					this.view.set('ready');
				},
				error: (error: unknown) => {
					const view = viewOfLoadError(error);
					this.view.set(view === 'forbidden' ? 'forbidden' : 'error');
				}
			});
	}

	setMember(row: IInboxMemberRow, member: boolean): void {
		this.rows.set(this.rows().map((entry) => (entry.user.id === row.user.id ? { ...entry, member } : entry)));
	}

	setRole(row: IInboxMemberRow, role: InboxMailboxMemberRoleEnum): void {
		this.rows.set(this.rows().map((entry) => (entry.user.id === row.user.id ? { ...entry, role } : entry)));
	}

	save(): void {
		const mailboxId = this.mailbox?.id;
		if (this.saving() || this.view() !== 'ready' || !mailboxId) return;
		const members = this.rows()
			.filter((row) => row.member)
			.map((row) => ({ userId: row.user.id, role: row.role }));
		this.saving.set(true);
		this.apiError.set(null);
		this.api
			.setMembers(mailboxId as ID, members, this.organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (saved) => {
					this.saving.set(false);
					this.dialogRef.close({ members: saved } satisfies IInboxMailboxMembersDialogResult);
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
