// cspell:ignore unsnooze
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbTagModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	IInboxItemOption,
	IInboxItemWithState,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	INBOX_DECISION_KINDS,
	InboxItemKindEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import {
	escalationDetails,
	INBOX_REPLY_MAX,
	INBOX_SNOOZE_PRESETS,
	InboxSnoozePreset,
	isArchived,
	isSnoozed,
	isTranslationKey,
	isUnread,
	linksOf,
	optionsOf,
	replyProblem,
	snoozeUntil,
	sourceLabelOf
} from '../../inbox-ui.helpers';
import { InboxEmailViewerComponent } from '../inbox-email-viewer/inbox-email-viewer.component';

/**
 * The detail pane of one inbox item (plan 04 §1): what it asks, its answer, the reply composer for a
 * question, an approval or an escalation, the sandboxed viewer for an email, and the recipient's own actions
 * (read / unread, archive, snooze, open the linked task, project or agent).
 */
@Component({
	selector: 'ngx-inbox-item-detail',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		RouterLink,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbTagModule,
		TranslatePipe,
		InboxEmailViewerComponent
	],
	template: `
		@let current = item();
		<nb-card class="detail" data-test="detail">
			<nb-card-header class="detail-header">
				<div class="title" data-test="detail-title">{{ current.title }}</div>
				<div class="meta">
					<span class="chip" data-test="detail-kind">{{ 'INBOX.KIND.' + current.kind | translate }}</span>
					<span class="chip" data-test="detail-source">{{
						isKey(sourceLabel()) ? (sourceLabel() | translate) : sourceLabel()
					}}</span>
					@if (current.priority === 'high' || current.priority === 'urgent') {
						<span class="chip priority" data-test="detail-priority">{{
							'INBOX.PRIORITY.' + current.priority | translate
						}}</span>
					}
					<span class="chip">{{ 'INBOX.STATUS.' + current.status | translate }}</span>
					@if (current.dueAt) {
						<span class="chip">{{
							'INBOX.DUE' | translate: { date: (current.dueAt | date: 'medium') }
						}}</span>
					}
					<span class="when">{{ current.createdAt | date: 'medium' }}</span>
				</div>
			</nb-card-header>
			<nb-card-body>
				@if (current.kind === kinds.EMAIL) {
					<ngx-inbox-email-viewer [text]="current.body" [title]="current.title"></ngx-inbox-email-viewer>
				} @else if (current.body) {
					<div class="body" data-test="detail-body">{{ current.body }}</div>
				}

				@if (current.kind === kinds.ESCALATION) {
					<div class="escalation" data-test="escalation">
						@if (escalation().decisionNeeded) {
							<p>
								<strong>{{ 'INBOX.ESCALATION.DECISION' | translate }}</strong>
								{{ escalation().decisionNeeded }}
							</p>
						}
						@if (escalation().attempted.length) {
							<p>
								<strong>{{ 'INBOX.ESCALATION.ATTEMPTED' | translate }}</strong>
							</p>
							<ul>
								@for (attempt of escalation().attempted; track $index) {
									<li>{{ attempt }}</li>
								}
							</ul>
						}
						@if (escalation().confidence !== null) {
							<p data-test="confidence">
								<strong>{{ 'INBOX.ESCALATION.CONFIDENCE' | translate }}</strong>
								{{ escalation().confidence }}%
							</p>
						}
					</div>
				}

				@if (current.response) {
					<div class="answer" data-test="answer">
						<strong>{{
							'INBOX.ANSWERED' | translate: { date: (current.response.answeredAt | date: 'medium') }
						}}</strong>
						@if (answeredOption(); as option) {
							<div>{{ isKey(option.label) ? (option.label | translate) : option.label }}</div>
						}
						@if (current.response.text) {
							<div class="body">{{ current.response.text }}</div>
						}
						@if (current.response.routed && current.response.routed !== 'local') {
							<div class="routed">
								{{ 'INBOX.ROUTED' | translate: { routed: current.response.routed } }}
							</div>
						}
					</div>
				}

				@if (canReply()) {
					<form class="composer" data-test="composer" (ngSubmit)="send()">
						@if (options().length) {
							<div
								class="options"
								role="radiogroup"
								[attr.aria-label]="'INBOX.REPLY.OPTIONS' | translate"
							>
								@for (option of options(); track option.id) {
									<button
										type="button"
										nbButton
										size="small"
										role="radio"
										[attr.aria-checked]="optionId() === option.id"
										[attr.data-test]="'option-' + option.id"
										[status]="
											optionId() === option.id ? 'primary' : option.recommended ? 'info' : 'basic'
										"
										[outline]="optionId() !== option.id"
										[attr.title]="option.description ?? null"
										(click)="choose(option)"
									>
										{{ isKey(option.label) ? (option.label | translate) : option.label }}
										@if (option.recommended) {
											<span class="recommended"
												>· {{ 'INBOX.REPLY.RECOMMENDED' | translate }}</span
											>
										}
									</button>
								}
							</div>
						}
						<label class="label" for="inbox-reply-text">{{ textLabel() | translate }}</label>
						<textarea
							id="inbox-reply-text"
							nbInput
							fullWidth
							rows="3"
							name="text"
							data-test="reply-text"
							[maxlength]="maxText"
							[ngModel]="text()"
							(ngModelChange)="text.set($event)"
						></textarea>
						@if (problem() === 'REASON_REQUIRED') {
							<div class="hint" data-test="reason-required">
								{{ 'INBOX.REPLY.REASON_REQUIRED' | translate }}
							</div>
						}
						@if (error()) {
							<nb-alert status="danger" role="alert" data-test="reply-error">{{ error() }}</nb-alert>
						}
						<button
							nbButton
							status="primary"
							size="small"
							type="submit"
							data-test="send"
							[disabled]="!!problem() || busy()"
						>
							{{ 'INBOX.REPLY.SEND' | translate }}
						</button>
					</form>
				}
			</nb-card-body>
			@if (current.recipient) {
				<nb-card-footer class="actions" data-test="actions">
					<button
						nbButton
						ghost
						size="small"
						data-test="toggle-read"
						[disabled]="busy()"
						(click)="toggleRead()"
					>
						<nb-icon [icon]="unread() ? 'email-outline' : 'email'"></nb-icon>
						{{ (unread() ? 'INBOX.ACTIONS.MARK_READ' : 'INBOX.ACTIONS.MARK_UNREAD') | translate }}
					</button>
					<button
						nbButton
						ghost
						size="small"
						data-test="toggle-archive"
						[disabled]="busy()"
						(click)="toggleArchive()"
					>
						<nb-icon [icon]="archived() ? 'arrow-circle-up-outline' : 'archive-outline'"></nb-icon>
						{{ (archived() ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate }}
					</button>
					@if (snoozed()) {
						<button
							nbButton
							ghost
							size="small"
							data-test="unsnooze"
							[disabled]="busy()"
							(click)="unsnooze()"
						>
							<nb-icon icon="bell-outline"></nb-icon>
							{{
								'INBOX.ACTIONS.UNSNOOZE'
									| translate: { date: (current.recipient.snoozedUntil | date: 'medium') }
							}}
						</button>
					} @else {
						@for (preset of snoozePresets; track preset) {
							<button
								nbButton
								ghost
								size="small"
								[attr.data-test]="'snooze-' + preset"
								[disabled]="busy()"
								(click)="snooze(preset)"
							>
								<nb-icon icon="clock-outline"></nb-icon>
								{{ 'INBOX.SNOOZE.' + preset | translate }}
							</button>
						}
					}
					@for (link of links(); track link.kind) {
						<a
							nbButton
							ghost
							size="small"
							[attr.data-test]="'open-' + link.kind"
							[routerLink]="link.commands"
						>
							<nb-icon icon="external-link-outline"></nb-icon>
							{{ 'INBOX.OPEN.' + link.kind | translate }}
						</a>
					}
				</nb-card-footer>
			}
		</nb-card>
	`,
	styles: [
		`
			.detail-header .title {
				font-weight: 600;
				font-size: 1.1rem;
				margin-bottom: 0.25rem;
			}
			.meta {
				display: flex;
				flex-wrap: wrap;
				gap: 0.4rem;
				align-items: center;
				font-size: 0.8rem;
			}
			.chip {
				padding: 0 0.4rem;
				border-radius: 0.6rem;
				background: var(--background-basic-color-3, #edf1f7);
			}
			.chip.priority {
				background: var(--color-danger-100, #ffe3e0);
			}
			.when {
				opacity: 0.7;
			}
			.body {
				white-space: pre-wrap;
				overflow-wrap: anywhere;
				margin-bottom: 1rem;
			}
			.answer {
				padding: 0.75rem;
				border-radius: 4px;
				background: var(--background-basic-color-2, #f7f9fc);
				margin-bottom: 1rem;
			}
			.routed,
			.hint {
				font-size: 0.8rem;
				opacity: 0.8;
			}
			.composer {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
			}
			.options {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
			}
			.recommended {
				font-size: 0.75em;
			}
			.label {
				font-size: 0.85rem;
			}
			.actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
			}
		`
	]
})
export class InboxItemDetailComponent {
	readonly item = input.required<IInboxItemWithState>();
	/** A request of the page for this item is running. */
	readonly busy = input<boolean>(false);
	/** Why the last reply failed (the API's message, e.g. "Already decided in Ever Works"). */
	readonly error = input<string | null>(null);

	readonly replied = output<IInboxReplyInput>();
	readonly stateChanged = output<IInboxRecipientStateInput>();

	protected readonly kinds = InboxItemKindEnum;
	protected readonly snoozePresets = INBOX_SNOOZE_PRESETS;
	protected readonly maxText = INBOX_REPLY_MAX;

	readonly text = signal('');
	readonly optionId = signal<string | null>(null);

	readonly options = computed(() => optionsOf(this.item()));
	readonly escalation = computed(() => escalationDetails(this.item()));
	readonly links = computed(() => linksOf(this.item()));
	readonly unread = computed(() => isUnread(this.item()));
	readonly archived = computed(() => isArchived(this.item()));
	readonly snoozed = computed(() => isSnoozed(this.item()));
	readonly problem = computed(() => replyProblem(this.item(), this.text(), this.optionId()));
	/** Only a recipient answers (a mailbox reader only reads), and only an open decision. */
	readonly canReply = computed(() => {
		const item = this.item();
		return !!item.recipient && INBOX_DECISION_KINDS.includes(item.kind) && item.status === InboxItemStatusEnum.OPEN;
	});
	readonly answeredOption = computed(() => {
		const response = this.item().response;
		return response?.optionId ? (this.options().find((option) => option.id === response.optionId) ?? null) : null;
	});
	/** The source's name: translated for the known sources, as stated for a handler's own. */
	readonly sourceLabel = computed(() => sourceLabelOf(this.item().source));
	readonly textLabel = computed(() => {
		const item = this.item();
		if (item.requireReason) return 'INBOX.REPLY.REASON';
		if (item.kind === InboxItemKindEnum.APPROVAL) return 'INBOX.REPLY.NOTE';
		if (item.kind === InboxItemKindEnum.ESCALATION) return 'INBOX.REPLY.RESOLVE_NOTE';
		return 'INBOX.REPLY.TEXT';
	});

	constructor() {
		// Another item: start a fresh reply.
		let shownId: string | undefined;
		effect(() => {
			const id = this.item().id;
			if (id !== shownId) {
				shownId = id;
				this.text.set('');
				this.optionId.set(null);
			}
		});
	}

	/** Whether the label is a translation key (the default Approve / Reject). */
	isKey(label: string): boolean {
		return isTranslationKey(label);
	}

	choose(option: IInboxItemOption): void {
		this.optionId.set(this.optionId() === option.id ? null : option.id);
	}

	send(): void {
		if (this.problem() || this.busy()) return;
		const text = this.text().trim();
		const optionId = this.optionId();
		this.replied.emit({ ...(text ? { text } : {}), ...(optionId ? { optionId } : {}) });
	}

	toggleRead(): void {
		this.stateChanged.emit({ isRead: this.unread() });
	}

	toggleArchive(): void {
		this.stateChanged.emit({ isArchived: !this.archived() });
	}

	snooze(preset: InboxSnoozePreset): void {
		this.stateChanged.emit({ snoozedUntil: snoozeUntil(preset).toISOString() });
	}

	unsnooze(): void {
		this.stateChanged.emit({ snoozedUntil: null });
	}
}
