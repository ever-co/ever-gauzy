import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { INBOX_LINK, INBOX_MAILBOXES_SETTINGS_LINK } from '../inbox-ui.constants';
import { IInboxMyMailbox, InboxEmailSettingsService } from '../services/inbox-email-settings.service';
import { InboxSettingsView, viewOfLoadError } from './inbox-settings.helpers';
import { isSharedMailbox } from './mailbox-settings.helpers';

/**
 * "My mailbox" (`/pages/inbox/mailbox`, plan 04 §5.1, G-P4-1; `INBOX_VIEW`): the addresses whose mail reaches me —
 * my own employee mailbox and the shared ones I receive — each with its address to copy and, for a platform address,
 * the API's forwarding instructions (forward an existing mailbox there: no DNS change). A manager is pointed to
 * Settings → Inbox → Mailboxes. A 404 means the Inbox email features are off on this installation.
 */
@Component({
	selector: 'ngx-inbox-my-mailbox-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, TranslatePipe],
	template: `
		<nb-card class="page" data-test="my-mailbox-page">
			<nb-card-header class="header">
				<div>
					<h4>{{ 'INBOX.MY_MAILBOX.TITLE' | translate }}</h4>
					<p class="subtitle">{{ 'INBOX.MY_MAILBOX.SUBTITLE' | translate }}</p>
				</div>
				<a nbButton ghost size="small" data-test="back" [routerLink]="inboxLink">{{
					'INBOX.MY_MAILBOX.BACK' | translate
				}}</a>
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
						<p data-test="forbidden">{{ 'INBOX.MY_MAILBOX.FORBIDDEN' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{
							'INBOX.MY_MAILBOX.ERROR' | translate
						}}</nb-alert>
						<button nbButton size="small" type="button" data-test="retry" (click)="load()">
							{{ 'INBOX.RETRY' | translate }}
						</button>
					}
					@default {
						@for (mailbox of mailboxes(); track mailbox.id) {
							<div class="mailbox" [attr.data-test]="'my-mailbox-' + mailbox.id">
								<div class="address">
									<code>{{ mailbox.address }}</code>
									<button
										nbButton
										ghost
										size="tiny"
										type="button"
										[attr.aria-label]="'INBOX.SETTINGS.COPY' | translate"
										(click)="copy(mailbox.address)"
									>
										<nb-icon icon="copy-outline"></nb-icon>
									</button>
								</div>
								<div class="meta">
									@if (mailbox.displayName) {
										<span>{{ mailbox.displayName }}</span>
									}
									<span class="chip">{{
										(shared(mailbox) ? 'INBOX.MY_MAILBOX.SHARED' : 'INBOX.MY_MAILBOX.PERSONAL') | translate
									}}</span>
									<span class="chip">{{ 'INBOX.SETTINGS.KIND.' + mailbox.kind | translate }}</span>
									@if (mailbox.isDefault) {
										<span class="chip">{{ 'INBOX.SETTINGS.MAILBOXES.IS_DEFAULT' | translate }}</span>
									}
									@if (mailbox.isActive === false) {
										<span class="chip">{{ 'INBOX.SETTINGS.MAILBOXES.INACTIVE' | translate }}</span>
									}
									<span>
										{{ 'INBOX.MY_MAILBOX.MESSAGES' | translate: { count: mailbox.messageCount ?? 0 } }}
										@if (mailbox.lastMessageAt) {
											· {{ 'INBOX.SETTINGS.MAILBOXES.LAST_MESSAGE' | translate }}
											{{ mailbox.lastMessageAt | date: 'medium' }}
										}
									</span>
								</div>
								@if (mailbox.forwardingInstructions) {
									<p class="instructions" [attr.data-test]="'instructions-' + mailbox.id">
										<nb-icon icon="info-outline"></nb-icon>
										{{ mailbox.forwardingInstructions }}
									</p>
								}
							</div>
						} @empty {
							<p class="hint" data-test="empty">{{ 'INBOX.MY_MAILBOX.EMPTY' | translate }}</p>
						}
						@if (canManage) {
							<a nbButton size="small" status="basic" data-test="manage" [routerLink]="settingsLink">{{
								'INBOX.MY_MAILBOX.MANAGE' | translate
							}}</a>
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
			.mailbox {
				padding: 0.75rem 1rem;
				margin-bottom: 0.75rem;
				border: 1px solid var(--border-basic-color-4, #e4e9f2);
				border-radius: 0.5rem;
			}
			.address code {
				font-size: 0.95rem;
				font-weight: 600;
			}
			.meta {
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
			.instructions {
				display: flex;
				gap: 0.4rem;
				align-items: flex-start;
				margin: 0.5rem 0 0;
				font-size: 0.85rem;
			}
			.loading {
				min-height: 8rem;
			}
		`
	]
})
export class InboxMyMailboxPageComponent implements OnInit {
	private readonly api = inject(InboxEmailSettingsService);
	private readonly store = inject(Store);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly inboxLink = INBOX_LINK;
	protected readonly settingsLink = INBOX_MAILBOXES_SETTINGS_LINK;

	readonly view = signal<InboxSettingsView>('loading');
	readonly mailboxes = signal<IInboxMyMailbox[]>([]);
	/** Whether to point to Settings → Inbox → Mailboxes. */
	canManage = false;

	ngOnInit(): void {
		this.canManage = this.store.hasPermission(PermissionsEnum.INBOX_MAILBOX_MANAGE);
		this.load();
	}

	load(): void {
		this.view.set('loading');
		this.api
			.myMailboxes()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (mailboxes) => {
					this.mailboxes.set(mailboxes ?? []);
					this.view.set('ready');
				},
				error: (error: unknown) => this.view.set(viewOfLoadError(error))
			});
	}

	shared(mailbox: IInboxMyMailbox): boolean {
		return isSharedMailbox(mailbox);
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
