// cspell:ignore referrerpolicy
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCheckboxModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CHAT_WEBHOOK_MAX_PER_CONVERSATION, CHAT_WEBHOOK_NAME_MAX_LENGTH, ID, IChatWebhook, IChatWebhookUpdateInput, IChatWebhookWriteResult } from '@gauzy/contracts';
import { safeIconUrl } from '../chat-app-blocks';
import { apiErrorMessage } from '../chat-ui.helpers';
import { ChatPeople, EMPTY_PEOPLE } from '../services/chat-people.service';
import { ChatWebhooksService } from '../services/chat-webhooks.service';

/** The form of a webhook, new or edited. */
interface WebhookForm {
	name: string;
	iconUrl: string;
	interactionUrl: string;
	canBroadcast: boolean;
}

const EMPTY_FORM: WebhookForm = { name: '', iconUrl: '', interactionUrl: '', canBroadcast: false };

/** What a write made that is shown this once: the URL senders post to, the signing secret of the callbacks. */
export interface WebhookSecrets {
	webhookId: ID;
	name: string;
	url?: string;
	signingSecret?: string;
}

/** The changes a form makes to a webhook (only what differs; an emptied URL is `null`, which clears it). */
export function webhookChanges(webhook: Pick<IChatWebhook, 'name' | 'iconUrl' | 'interactionUrl' | 'canBroadcast'>, form: WebhookForm): IChatWebhookUpdateInput {
	const changes: IChatWebhookUpdateInput = {};
	const name = form.name.trim();
	if (name && name !== webhook.name) changes.name = name;
	const iconUrl = form.iconUrl.trim() || null;
	if (iconUrl !== (webhook.iconUrl ?? null)) changes.iconUrl = iconUrl;
	const interactionUrl = form.interactionUrl.trim() || null;
	if (interactionUrl !== (webhook.interactionUrl ?? null)) changes.interactionUrl = interactionUrl;
	if (form.canBroadcast !== !!webhook.canBroadcast) changes.canBroadcast = form.canBroadcast;
	return changes;
}

/**
 * The Integrations tab of a channel's settings, for its managers: the channel's incoming webhooks (name, icon, who
 * made it and when, when it was last used, its counters), a new one (its URL and signing secret shown once, with
 * copy buttons), and for each one rename / icon / interaction URL / broadcast, a new signing secret, and revoke.
 */
@Component({
	selector: 'ngx-chat-webhooks-panel',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NgTemplateOutlet, FormsModule, NbButtonModule, NbCheckboxModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
	template: `
		<section class="webhooks" data-test="webhooks-panel">
			<p class="note">{{ 'CHAT.WEBHOOKS.INTRO' | translate }}</p>

			@if (secrets(); as shown) {
				<div class="secrets" role="status" data-test="webhook-secrets">
					<p class="secrets-title">{{ 'CHAT.WEBHOOKS.SHOWN_ONCE' | translate: { name: shown.name } }}</p>
					@if (shown.url) {
						<label class="field">
							<span>{{ 'CHAT.WEBHOOKS.URL' | translate }}</span>
							<span class="copy-row">
								<input nbInput fullWidth readonly [value]="shown.url" data-test="webhook-url" (focus)="select($event)" />
								<button nbButton size="small" status="basic" type="button" data-test="copy-url" (click)="copy(shown.url, 'url')">
									{{ (copied() === 'url' ? 'CHAT.WEBHOOKS.COPIED' : 'CHAT.WEBHOOKS.COPY') | translate }}
								</button>
							</span>
						</label>
					}
					@if (shown.signingSecret) {
						<label class="field">
							<span>{{ 'CHAT.WEBHOOKS.SIGNING_SECRET' | translate }}</span>
							<span class="copy-row">
								<input nbInput fullWidth readonly [value]="shown.signingSecret" data-test="webhook-secret" (focus)="select($event)" />
								<button nbButton size="small" status="basic" type="button" data-test="copy-secret" (click)="copy(shown.signingSecret, 'secret')">
									{{ (copied() === 'secret' ? 'CHAT.WEBHOOKS.COPIED' : 'CHAT.WEBHOOKS.COPY') | translate }}
								</button>
							</span>
						</label>
					}
					<button nbButton ghost size="small" type="button" data-test="secrets-done" (click)="dismissSecrets()">{{ 'CHAT.WEBHOOKS.DONE' | translate }}</button>
				</div>
			}

			@if (loading()) {
				<div class="loading" [nbSpinner]="true"></div>
			} @else {
				<ul class="rows" data-test="webhooks">
					@for (webhook of webhooks(); track webhook.id) {
						<li class="webhook" [class.revoked]="!!webhook.revokedAt" [attr.data-test]="'webhook-' + webhook.id">
							<div class="head">
								@if (iconOf(webhook); as icon) {
									<img class="icon" [src]="icon" alt="" referrerpolicy="no-referrer" loading="lazy" />
								} @else {
									<span class="icon placeholder" aria-hidden="true"><nb-icon icon="code-outline"></nb-icon></span>
								}
								<span class="grow">
									<span class="name">{{ webhook.name }}</span>
									<span class="meta">
										{{ 'CHAT.WEBHOOKS.CREATED_BY' | translate: { name: creatorOf(webhook), date: (webhook.createdAt | date: 'mediumDate') } }}
										· …{{ webhook.tokenHint }}
										@if (webhook.lastUsedAt) {
											· {{ 'CHAT.WEBHOOKS.LAST_USED' | translate: { date: (webhook.lastUsedAt | date: 'short') } }}
										} @else {
											· {{ 'CHAT.WEBHOOKS.NEVER_USED' | translate }}
										}
									</span>
									<span class="meta">
										{{ 'CHAT.WEBHOOKS.COUNTS' | translate: { accepted: webhook.acceptedCount, rejected: webhook.rejectedCount, limited: webhook.rateLimitedCount, failures: webhook.callbackFailureCount } }}
									</span>
								</span>
								@if (webhook.revokedAt) {
									<span class="badge">{{ 'CHAT.WEBHOOKS.REVOKED' | translate }}</span>
								} @else {
									<button nbButton ghost size="tiny" type="button" [attr.data-test]="'edit-webhook-' + webhook.id" [nbTooltip]="'CHAT.WEBHOOKS.EDIT' | translate" [attr.aria-label]="'CHAT.WEBHOOKS.EDIT_NAMED' | translate: { name: webhook.name }" [disabled]="busy() || !!secrets()" (click)="startEdit(webhook)">
										<nb-icon icon="edit-outline"></nb-icon>
									</button>
									<button nbButton ghost size="tiny" type="button" [attr.data-test]="'rotate-webhook-' + webhook.id" [nbTooltip]="'CHAT.WEBHOOKS.ROTATE' | translate" [attr.aria-label]="'CHAT.WEBHOOKS.ROTATE_NAMED' | translate: { name: webhook.name }" [disabled]="busy() || !!secrets()" (click)="rotate(webhook)">
										<nb-icon icon="refresh-outline"></nb-icon>
									</button>
									<button nbButton ghost size="tiny" status="danger" type="button" [attr.data-test]="'revoke-webhook-' + webhook.id" [nbTooltip]="'CHAT.WEBHOOKS.REVOKE' | translate" [attr.aria-label]="'CHAT.WEBHOOKS.REVOKE_NAMED' | translate: { name: webhook.name }" [disabled]="busy()" (click)="revoke(webhook)">
										<nb-icon icon="slash-outline"></nb-icon>
									</button>
								}
							</div>
							@if (editingId() === webhook.id) {
								<form class="form" (ngSubmit)="saveEdit(webhook)" data-test="edit-webhook-form">
									<ng-container *ngTemplateOutlet="fields"></ng-container>
									<div class="actions">
										<button nbButton ghost size="small" type="button" (click)="cancelEdit()">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
										<button nbButton size="small" status="primary" type="submit" data-test="save-webhook" [disabled]="busy() || !!secrets() || !form().name.trim()">{{ 'CHAT.SETTINGS.SAVE' | translate }}</button>
									</div>
								</form>
							}
						</li>
					} @empty {
						<li class="note" data-test="no-webhooks">{{ 'CHAT.WEBHOOKS.EMPTY' | translate }}</li>
					}
				</ul>

				@if (creating()) {
					<form class="form" (ngSubmit)="create()" data-test="create-webhook-form">
						<ng-container *ngTemplateOutlet="fields"></ng-container>
						<div class="actions">
							<button nbButton ghost size="small" type="button" (click)="creating.set(false)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
							<button nbButton size="small" status="primary" type="submit" data-test="create-webhook" [disabled]="busy() || !!secrets() || !form().name.trim()">{{ 'CHAT.WEBHOOKS.CREATE' | translate }}</button>
						</div>
					</form>
				} @else if (!editingId()) {
					<button nbButton size="small" status="basic" type="button" data-test="new-webhook" [disabled]="busy() || full() || !!secrets()" (click)="startCreate()">
						<nb-icon icon="plus-outline"></nb-icon>
						{{ 'CHAT.WEBHOOKS.NEW' | translate }}
					</button>
					@if (full()) {
						<p class="note">{{ 'CHAT.WEBHOOKS.FULL' | translate: { max: maxWebhooks } }}</p>
					}
				}
			}

			@if (error()) {
				<p class="error" role="alert" data-test="webhooks-error">{{ error() }}</p>
			}

			<ng-template #fields>
				<label class="field">
					<span>{{ 'CHAT.WEBHOOKS.NAME' | translate }}</span>
					<input nbInput fullWidth name="name" data-test="webhook-name" [maxlength]="nameMax" [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" required />
				</label>
				<label class="field">
					<span>{{ 'CHAT.WEBHOOKS.ICON_URL' | translate }}</span>
					<input nbInput fullWidth name="iconUrl" type="url" data-test="webhook-icon" placeholder="https://" maxlength="2048" [ngModel]="form().iconUrl" (ngModelChange)="patch({ iconUrl: $event })" />
				</label>
				<label class="field">
					<span>{{ 'CHAT.WEBHOOKS.INTERACTION_URL' | translate }}</span>
					<input nbInput fullWidth name="interactionUrl" type="url" data-test="webhook-interaction" placeholder="https://" maxlength="2048" [ngModel]="form().interactionUrl" (ngModelChange)="patch({ interactionUrl: $event })" />
					<span class="hint">{{ 'CHAT.WEBHOOKS.INTERACTION_HINT' | translate }}</span>
				</label>
				<nb-checkbox name="canBroadcast" data-test="webhook-broadcast" [checked]="form().canBroadcast" (checkedChange)="patch({ canBroadcast: $event })">
					{{ 'CHAT.WEBHOOKS.BROADCAST' | translate }}
				</nb-checkbox>
			</ng-template>
		</section>
	`,
	styles: [
		`
			.webhooks {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.note,
			.hint {
				margin: 0;
				font-size: 0.8125rem;
				opacity: 0.7;
			}
			.rows {
				margin: 0;
				padding: 0;
				list-style: none;
				max-height: 40vh;
				overflow-y: auto;
			}
			.webhook {
				padding: 0.5rem 0.25rem;
				border-bottom: 1px solid var(--border-basic-color-3);
			}
			.webhook.revoked {
				opacity: 0.6;
			}
			.head {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.grow {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				min-width: 0;
			}
			.name {
				font-weight: 600;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.meta {
				font-size: 0.75rem;
				opacity: 0.7;
			}
			.icon {
				flex: 0 0 auto;
				width: 2rem;
				height: 2rem;
				border-radius: var(--border-radius);
				object-fit: cover;
			}
			.icon.placeholder {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				background: var(--background-basic-color-3);
			}
			.badge {
				font-size: 0.6875rem;
				padding: 0.125rem 0.375rem;
				border-radius: var(--border-radius);
				background: var(--background-basic-color-3);
			}
			.form {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				margin-top: 0.5rem;
			}
			.field {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				font-size: 0.8125rem;
			}
			.copy-row {
				display: flex;
				gap: 0.5rem;
				align-items: center;
			}
			.actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.5rem;
			}
			.secrets {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 0.75rem;
				border-radius: var(--border-radius);
				background: var(--color-warning-transparent-100);
			}
			.secrets-title {
				margin: 0;
				font-size: 0.8125rem;
				font-weight: 600;
			}
			.loading {
				min-height: 3rem;
			}
			.error {
				margin: 0;
				color: var(--color-danger-default);
				font-size: 0.8125rem;
			}
		`
	]
})
export class ChatWebhooksPanelComponent implements OnInit {
	private readonly api = inject(ChatWebhooksService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	readonly conversationId = input.required<ID>();
	readonly people = input<ChatPeople>(EMPTY_PEOPLE);
	/** The list the settings already read (to learn whether webhooks are on): shown without a second read. */
	readonly initial = input<IChatWebhook[] | null>(null);
	/** Whether a write (create, change, new secret, revoke) is under way: the dialog waits for it before it closes. */
	readonly busyChange = output<boolean>();
	/** A write made a URL or signing secret, shown here this once: the dialog brings this tab forward and stays open. */
	readonly secretsShown = output<void>();
	/** The manager dismissed the URL or signing secret on screen ("I have copied them"). */
	readonly secretsDismissed = output<void>();
	/** A write failed: its error shows here, so the dialog stays open on this tab. */
	readonly writeFailed = output<void>();

	protected readonly maxWebhooks = CHAT_WEBHOOK_MAX_PER_CONVERSATION;
	protected readonly nameMax = CHAT_WEBHOOK_NAME_MAX_LENGTH;
	protected readonly webhooks = signal<IChatWebhook[]>([]);
	protected readonly loading = signal(true);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly creating = signal(false);
	protected readonly editingId = signal<ID | null>(null);
	protected readonly form = signal<WebhookForm>({ ...EMPTY_FORM });
	protected readonly secrets = signal<WebhookSecrets | null>(null);
	protected readonly copied = signal<'url' | 'secret' | null>(null);
	protected readonly full = computed(() => this.webhooks().filter((webhook) => !webhook.revokedAt).length >= CHAT_WEBHOOK_MAX_PER_CONVERSATION);

	ngOnInit(): void {
		const initial = this.initial();
		if (initial) {
			this.webhooks.set(initial);
			this.loading.set(false);
			return;
		}
		this.reload();
	}

	protected iconOf(webhook: IChatWebhook): string | null {
		return safeIconUrl(webhook.iconUrl);
	}

	protected creatorOf(webhook: IChatWebhook): string {
		const person = webhook.createdByEmployeeId ? this.people().byEmployee.get(String(webhook.createdByEmployeeId)) : null;
		return person?.name ?? '…';
	}

	protected patch(change: Partial<WebhookForm>): void {
		this.form.set({ ...this.form(), ...change });
	}

	protected startCreate(): void {
		this.form.set({ ...EMPTY_FORM });
		this.editingId.set(null);
		this.creating.set(true);
		this.error.set(null);
	}

	protected startEdit(webhook: IChatWebhook): void {
		this.creating.set(false);
		this.form.set({ name: webhook.name, iconUrl: webhook.iconUrl ?? '', interactionUrl: webhook.interactionUrl ?? '', canBroadcast: !!webhook.canBroadcast });
		this.editingId.set(webhook.id as ID);
		this.error.set(null);
	}

	protected cancelEdit(): void {
		this.editingId.set(null);
	}

	protected create(): void {
		const form = this.form();
		// A URL or signing secret on screen is shown once: no write that may make another until it is dismissed.
		if (!form.name.trim() || this.busy() || this.secrets()) return;
		this.run(
			this.api.create(this.conversationId(), {
				name: form.name.trim(),
				iconUrl: form.iconUrl.trim() || null,
				interactionUrl: form.interactionUrl.trim() || null,
				canBroadcast: form.canBroadcast
			}),
			(result) => {
				this.creating.set(false);
				this.webhooks.set([result.webhook, ...this.webhooks()]);
			}
		);
	}

	protected saveEdit(webhook: IChatWebhook): void {
		if (this.secrets()) return;
		const changes = webhookChanges(webhook, this.form());
		if (!Object.keys(changes).length) {
			this.editingId.set(null);
			return;
		}
		this.run(this.api.update(webhook.id as ID, changes), (result) => {
			this.editingId.set(null);
			this.put(result.webhook);
		});
	}

	protected rotate(webhook: IChatWebhook): void {
		if (this.secrets()) return;
		if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.WEBHOOKS.ROTATE_CONFIRM', { name: webhook.name }))) return;
		this.run(this.api.rotateSecret(webhook.id as ID), (result) => this.put(result.webhook));
	}

	protected revoke(webhook: IChatWebhook): void {
		if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.WEBHOOKS.REVOKE_CONFIRM', { name: webhook.name }))) return;
		this.run(this.api.revoke(webhook.id as ID), (result) => this.put(result.webhook));
	}

	protected dismissSecrets(): void {
		this.secrets.set(null);
		this.secretsDismissed.emit();
	}

	protected select(event: Event): void {
		(event.target as HTMLInputElement | null)?.select?.();
	}

	protected copy(value: string, which: 'url' | 'secret'): void {
		const done = () => {
			this.copied.set(which);
			setTimeout(() => {
				if (this.copied() === which) this.copied.set(null);
			}, 2000);
		};
		const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
		if (clipboard?.writeText) {
			clipboard.writeText(value).then(done, () => this.error.set(this.translate.instant('CHAT.WEBHOOKS.COPY_FAILED')));
		} else {
			this.error.set(this.translate.instant('CHAT.WEBHOOKS.COPY_FAILED'));
		}
	}

	private reload(): void {
		this.loading.set(true);
		this.api
			.list(this.conversationId())
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (webhooks) => {
					this.webhooks.set(webhooks);
					this.loading.set(false);
				},
				error: (error) => {
					this.loading.set(false);
					this.fail(error);
				}
			});
	}

	private put(webhook: IChatWebhook): void {
		this.webhooks.set(this.webhooks().map((item) => (item.id === webhook.id ? webhook : item)));
	}

	/**
	 * Runs a write; whatever secret it made is shown (this once). The dialog learns when a write starts and ends, and
	 * when it made a secret, so it neither closes nor hides this tab before the secret shows.
	 */
	private run(request: Observable<IChatWebhookWriteResult>, done: (result: IChatWebhookWriteResult) => void): void {
		this.setBusy(true);
		this.error.set(null);
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (result) => {
				done(result);
				if (result.url || result.signingSecret) {
					this.copied.set(null);
					this.secrets.set({ webhookId: result.webhook.id as ID, name: result.webhook.name, url: result.url, signingSecret: result.signingSecret });
					this.secretsShown.emit();
				}
				this.setBusy(false);
			},
			error: (error) => {
				this.fail(error);
				// Before the write counts as ended: a close asked for meanwhile is dropped, so the error is read.
				this.writeFailed.emit();
				this.setBusy(false);
			}
		});
	}

	private setBusy(busy: boolean): void {
		this.busy.set(busy);
		this.busyChange.emit(busy);
	}

	private fail(error: unknown): void {
		this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
	}
}
