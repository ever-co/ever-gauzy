// cspell:ignore unsnooze
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
	activityOf,
	emailHeaderOf,
	escalationDetails,
	INBOX_REPLY_MAX,
	INBOX_SNOOZE_PRESETS,
	InboxSnoozePreset,
	isArchived,
	isDone,
	isSnoozed,
	isTranslationKey,
	isUnread,
	kindIconOf,
	linksOf,
	optionsOf,
	replyProblem,
	snoozeUntil,
	mailboxLabelOf,
	routedNoticeOf,
	sourceLabelOf
} from '../../inbox-ui.helpers';
import { InboxEmailViewerComponent } from '../inbox-email-viewer/inbox-email-viewer.component';

/**
 * The detail pane of one inbox item (plan 04 §1): what it asks, its answer, the reply composer for a
 * question, an approval or an escalation, the sandboxed viewer for an email, and the recipient's own actions
 * (read / unread, archive, snooze, done, open the linked task — at the comment for a comment notification —, project or agent).
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
		NbIconModule,
		NbTooltipModule,
		TranslatePipe,
		InboxEmailViewerComponent
	],
	template: `
		@let current = item();
		<article class="detail" data-test="detail">
			<header class="detail-header">
				@if (current.recipient) {
					<div class="toolbar" role="toolbar" data-test="actions">
						<button
							type="button"
							class="tool"
							data-test="toggle-read"
							[disabled]="busy()"
							[nbTooltip]="((unread() ? 'INBOX.ACTIONS.MARK_READ' : 'INBOX.ACTIONS.MARK_UNREAD') | translate) + ' (u)'"
							nbTooltipPlacement="top"
							(click)="toggleRead()"
						>
							<nb-icon [icon]="unread() ? 'done-all-outline' : 'email-outline'"></nb-icon>
							<span class="tool-label">{{
								(unread() ? 'INBOX.ACTIONS.MARK_READ' : 'INBOX.ACTIONS.MARK_UNREAD') | translate
							}}</span>
						</button>
						<button
							type="button"
							class="tool"
							data-test="toggle-archive"
							[disabled]="busy()"
							[nbTooltip]="((archived() ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate) + ' (e)'"
							nbTooltipPlacement="top"
							(click)="toggleArchive()"
						>
							<nb-icon [icon]="archived() ? 'arrow-circle-up-outline' : 'archive-outline'"></nb-icon>
							<span class="tool-label">{{
								(archived() ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate
							}}</span>
						</button>
						<button
							type="button"
							class="tool"
							data-test="toggle-done"
							[class.on]="done()"
							[disabled]="busy()"
							[nbTooltip]="((done() ? 'INBOX.ACTIONS.MARK_NOT_DONE' : 'INBOX.ACTIONS.MARK_DONE') | translate) + ' (d)'"
							nbTooltipPlacement="top"
							(click)="toggleDone()"
						>
							<nb-icon [icon]="done() ? 'undo-outline' : 'checkmark-circle-2-outline'"></nb-icon>
							<span class="tool-label">{{
								(done() ? 'INBOX.ACTIONS.MARK_NOT_DONE' : 'INBOX.ACTIONS.MARK_DONE') | translate
							}}</span>
						</button>
						@if (snoozed()) {
							<button
								type="button"
								class="tool on"
								data-test="unsnooze"
								[disabled]="busy()"
								(click)="unsnooze()"
							>
								<nb-icon icon="bell-outline"></nb-icon>
								<span class="tool-label">{{
									'INBOX.ACTIONS.UNSNOOZE'
										| translate: { date: (current.recipient.snoozedUntil | date: 'medium') }
								}}</span>
							</button>
						} @else {
							<div class="menu-anchor" (focusout)="closeSnoozeOnBlur($event)" (keydown.escape)="snoozeOpen.set(false)">
								<button
									type="button"
									class="tool"
									data-test="snooze-menu"
									aria-haspopup="menu"
									[nbTooltip]="'INBOX.SNOOZE.MENU' | translate"
									nbTooltipPlacement="top"
									[attr.aria-expanded]="snoozeOpen()"
									[disabled]="busy()"
									(click)="snoozeOpen.set(!snoozeOpen())"
								>
									<nb-icon icon="clock-outline"></nb-icon>
									<span class="tool-label">{{ 'INBOX.SNOOZE.MENU' | translate }}</span>
									<nb-icon class="chevron" icon="chevron-down-outline"></nb-icon>
								</button>
								@if (snoozeOpen()) {
									<div class="menu" role="menu">
										@for (preset of snoozePresets; track preset) {
											<button
												type="button"
												class="menu-item"
												role="menuitem"
												[attr.data-test]="'snooze-' + preset"
												[disabled]="busy()"
												(click)="snooze(preset)"
											>
												<nb-icon icon="clock-outline"></nb-icon>
												{{ 'INBOX.SNOOZE.' + preset | translate }}
											</button>
										}
									</div>
								}
							</div>
						}
					</div>
				}

				<div class="title-row">
					<span class="avatar" [attr.data-kind]="current.kind" aria-hidden="true">
						<nb-icon [icon]="kindIcon()"></nb-icon>
					</span>
					<div class="title-block">
						<h5 class="title" data-test="detail-title">{{ current.title }}</h5>
						<div class="meta">
							<span class="chip" data-test="detail-kind">{{ 'INBOX.KIND.' + current.kind | translate }}</span>
							<!-- An email from the Email source would say "Email" twice. -->
							@if (current.source !== current.kind) {
								<span class="chip" data-test="detail-source">{{
									isKey(sourceLabel()) ? (sourceLabel() | translate) : sourceLabel()
								}}</span>
							}
							@if (mailboxLabel(); as mailbox) {
								<span class="chip" data-test="detail-mailbox">{{ mailbox }}</span>
							}
							@if (current.priority === 'high' || current.priority === 'urgent') {
								<span class="chip priority" data-test="detail-priority">{{
									'INBOX.PRIORITY.' + current.priority | translate
								}}</span>
							}
							<!-- An email is read, not decided: it has no status to show. -->
							@if (current.kind !== kinds.EMAIL) {
								<span class="chip status" [attr.data-status]="current.status">{{
									'INBOX.STATUS.' + current.status | translate
								}}</span>
							}
							@if (current.dueAt) {
								<span class="chip due">
									<nb-icon icon="calendar-outline"></nb-icon>
									{{ 'INBOX.DUE' | translate: { date: (current.dueAt | date: 'medium') } }}
								</span>
							}
						</div>
					</div>
					<time
						class="when"
						[attr.datetime]="current.createdAt"
						[nbTooltip]="current.createdAt | date: 'medium'"
						nbTooltipPlacement="top"
						>{{ current.createdAt | date: 'MMM d, y, h:mm a' }}</time
					>
				</div>

				@if (links().length) {
					<div class="links">
						@for (link of links(); track link.kind) {
							<a
								class="link"
								[attr.data-test]="'open-' + link.kind"
								[routerLink]="link.commands"
								[queryParams]="link.queryParams ?? null"
							>
								<nb-icon icon="external-link-outline"></nb-icon>
								{{ 'INBOX.OPEN.' + link.kind | translate }}
							</a>
						}
					</div>
				}
			</header>

			<div class="detail-body">
				@if (current.kind === kinds.EMAIL) {
					<!-- A mail app's message header: who sent it, where it came, what it carries. -->
					@let mail = emailHeader();
					<div class="mail-head" data-test="email-header">
						<span class="sender" aria-hidden="true">
							@if (mail.initials) {
								{{ mail.initials }}
							} @else {
								<nb-icon icon="person-outline"></nb-icon>
							}
						</span>
						<div class="mail-who">
							<div class="mail-from">
								<span class="mail-name" data-test="email-from">{{
									mail.fromName ?? ('INBOX.EMAIL.UNKNOWN_SENDER' | translate)
								}}</span>
								@if (mail.fromAddress) {
									<span class="mail-address">&lt;{{ mail.fromAddress }}&gt;</span>
								}
							</div>
							@if (mail.to) {
								<div class="mail-to">{{ 'INBOX.EMAIL.TO' | translate: { to: mail.to } }}</div>
							}
						</div>
						@if (mail.attachments) {
							<span class="mail-attachments" data-test="email-attachments">
								<nb-icon icon="attach-outline"></nb-icon>
								{{ 'INBOX.EMAIL.ATTACHMENTS' | translate: { count: mail.attachments } }}
							</span>
						}
					</div>
					@if (mail.spam) {
						<div class="mail-spam" role="note" data-test="email-spam">
							<nb-icon icon="alert-triangle-outline"></nb-icon>
							{{ 'INBOX.EMAIL.SPAM.' + mail.spam | translate }}
						</div>
					}
					<ngx-inbox-email-viewer [text]="current.body" [title]="current.title"></ngx-inbox-email-viewer>
				} @else if (current.body) {
					<div class="body" data-test="detail-body">{{ current.body }}</div>
				}

				<!-- An escalation's details as an issue tracker's fields: a label on the left, its value on the right. -->
				@if (current.kind === kinds.ESCALATION) {
					@let details = escalation();
					@if (details.decisionNeeded || details.attempted.length || details.confidence !== null) {
						<dl class="fields" data-test="escalation">
							@if (details.decisionNeeded) {
								<div class="field">
									<dt>{{ 'INBOX.ESCALATION.DECISION' | translate }}</dt>
									<dd class="decision">{{ details.decisionNeeded }}</dd>
								</div>
							}
							@if (details.attempted.length) {
								<div class="field">
									<dt>{{ 'INBOX.ESCALATION.ATTEMPTED' | translate }}</dt>
									<dd>
										<ol class="tried">
											@for (attempt of details.attempted; track $index) {
												<li>{{ attempt }}</li>
											}
										</ol>
									</dd>
								</div>
							}
							@if (details.confidence !== null) {
								<div class="field" data-test="confidence">
									<dt>{{ 'INBOX.ESCALATION.CONFIDENCE' | translate }}</dt>
									<dd class="confidence" [attr.data-level]="confidenceLevel()">
										<span class="meter" aria-hidden="true">
											@for (segment of meterSegments; track segment) {
												<span [class.on]="segment * 10 <= details.confidence + 5"></span>
											}
										</span>
										<span class="confidence-value">{{ details.confidence }}%</span>
									</dd>
								</div>
							}
						</dl>
					}
				}

				<!-- The answer as a reply under the message: who decided what, and when; no coloured box. -->
				@if (current.response; as response) {
					<div class="reply" data-test="answer">
						<span class="reply-icon" aria-hidden="true"><nb-icon icon="corner-down-right-outline"></nb-icon></span>
						<div class="reply-content">
							<div class="reply-meta">
								{{ 'INBOX.ANSWERED' | translate: { date: (response.answeredAt | date: 'MMM d, y, h:mm a') } }}
							</div>
							@if (answeredOption(); as option) {
								<span class="choice" [attr.data-choice]="option.id">
									<span class="choice-dot" aria-hidden="true"></span>
									{{ isKey(option.label) ? (option.label | translate) : option.label }}
								</span>
							}
							@if (response.text) {
								<p class="reply-text">{{ response.text }}</p>
							}
							@if (routedNotice(); as notice) {
								@if (notice.alreadyDecided) {
									<div class="routed" data-test="already-decided">
										{{ 'INBOX.ALREADY_DECIDED' | translate: { source: (notice.source | translate) } }}
									</div>
								} @else {
									<div class="routed" data-test="routed">
										{{ 'INBOX.ROUTED' | translate: { routed: notice.routed } }}
									</div>
								}
							}
						</div>
					</div>
				}

				<!-- What happened to the item, oldest first: received, read, answered, done, archived, snoozed until. -->
				@if (activity().length) {
					<section class="activity" data-test="activity">
						<h6 class="activity-title">{{ 'INBOX.ACTIVITY.TITLE' | translate }}</h6>
						<ol class="timeline">
							@for (step of activity(); track step.event) {
								<li class="step" [attr.data-event]="step.event" [attr.data-test]="'activity-' + step.event">
									<span class="step-dot" aria-hidden="true"></span>
									<span class="step-label">{{ 'INBOX.ACTIVITY.' + step.event | translate }}</span>
									<time class="step-when" [attr.datetime]="step.at.toISOString()">{{
										step.at | date: 'MMM d, y, h:mm a'
									}}</time>
								</li>
							}
						</ol>
					</section>
				}
			</div>

			@if (canReply()) {
				<form class="composer" data-test="composer" (ngSubmit)="send()">
					@if (options().length) {
						<div class="options" role="radiogroup" [attr.aria-label]="'INBOX.REPLY.OPTIONS' | translate">
							@for (option of options(); track option.id) {
								<button
									type="button"
									class="option"
									role="radio"
									[class.chosen]="optionId() === option.id"
									[class.recommended]="option.recommended"
									[attr.aria-checked]="optionId() === option.id"
									[attr.data-test]="'option-' + option.id"
									[nbTooltip]="option.description ?? ''"
									[nbTooltipDisabled]="!option.description"
									nbTooltipPlacement="top"
									(click)="choose(option)"
								>
									@if (optionId() === option.id) {
										<nb-icon icon="checkmark-outline"></nb-icon>
									}
									{{ isKey(option.label) ? (option.label | translate) : option.label }}
									@if (option.recommended) {
										<span class="recommended-label">· {{ 'INBOX.REPLY.RECOMMENDED' | translate }}</span>
									}
								</button>
							}
						</div>
					}
					<label class="label" for="inbox-reply-text">{{ textLabel() | translate }}</label>
					<div class="composer-box">
						<textarea
							id="inbox-reply-text"
							rows="3"
							name="text"
							data-test="reply-text"
							[placeholder]="'INBOX.REPLY.PLACEHOLDER' | translate"
							[maxlength]="maxText"
							[ngModel]="text()"
							(ngModelChange)="text.set($event)"
							(keydown.control.enter)="send()"
							(keydown.meta.enter)="send()"
						></textarea>
						<div class="composer-actions">
							<span class="counter">{{ text().length }} / {{ maxText }}</span>
							<button
								nbButton
								status="primary"
								size="small"
								type="submit"
								data-test="send"
								[disabled]="!!problem() || busy()"
							>
								<nb-icon icon="paper-plane-outline"></nb-icon>
								{{ 'INBOX.REPLY.SEND' | translate }}
							</button>
						</div>
					</div>
					@if (problem() === 'REASON_REQUIRED') {
						<div class="hint" data-test="reason-required">
							{{ 'INBOX.REPLY.REASON_REQUIRED' | translate }}
						</div>
					}
					@if (error()) {
						<nb-alert status="danger" role="alert" data-test="reply-error">{{ error() }}</nb-alert>
					}
				</form>
			}
		</article>
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				min-height: 0;
				height: 100%;
			}
			.detail {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-height: 0;
			}

			/* Header: toolbar, title, links */
			.detail-header {
				padding: 0.5rem 1rem 0.75rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.toolbar {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.125rem;
				margin: 0 -0.375rem 0.625rem;
			}
			.tool {
				display: inline-flex;
				align-items: center;
				gap: 0.3rem;
				height: 1.75rem;
				padding: 0 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: var(--gauzy-text-color-2, #8f9bb3);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				white-space: nowrap;
				cursor: pointer;
				transition:
					background-color 0.12s ease,
					color 0.12s ease;
			}
			.tool nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}
			.tool:hover:not(:disabled),
			.tool[aria-expanded='true'] {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-1, #222b45);
			}
			.tool:focus-visible,
			.menu-item:focus-visible,
			.option:focus-visible,
			.link:focus-visible {
				outline: 2px solid var(--gauzy-action-info-text, #0095ff);
				outline-offset: 1px;
			}
			.tool.on {
				color: var(--color-primary-500, #6e49e8);
			}
			.tool:disabled {
				opacity: 0.5;
				cursor: default;
			}
			.tool .chevron {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			.menu-anchor {
				position: relative;
			}
			.menu {
				position: absolute;
				top: calc(100% + 0.25rem);
				left: 0;
				z-index: 10;
				min-width: 12rem;
				padding: 0.25rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				border-radius: 0.5rem;
				background: var(--background-basic-color-1, #fff);
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
			}
			.menu-item {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				width: 100%;
				padding: 0.375rem 0.5rem;
				border: 0;
				border-radius: 0.3125rem;
				background: none;
				color: var(--gauzy-text-color-1, #222b45);
				font: inherit;
				font-size: 0.75rem;
				line-height: 1rem;
				text-align: left;
				cursor: pointer;
			}
			.menu-item:hover:not(:disabled) {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
			}
			.menu-item nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}

			.title-row {
				display: flex;
				align-items: flex-start;
				gap: 0.625rem;
			}
			.title-block {
				flex: 1;
				min-width: 0;
			}
			.title {
				margin: 0 0 0.375rem;
				font-size: 0.875rem;
				font-weight: 600;
				line-height: 1.25rem;
				color: var(--gauzy-text-color-1, #222b45);
				overflow-wrap: anywhere;
			}
			.when {
				flex-shrink: 0;
				padding-top: 0.25rem;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				font-variant-numeric: tabular-nums;
			}
			.meta {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				align-items: center;
			}
			/* The task page's tag: square-ish, tinted, small. */
			.chip {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.0625rem 0.375rem;
				border: 1px solid transparent;
				border-radius: 0.1875rem;
				font-size: 0.6875rem;
				font-weight: 500;
				line-height: 1rem;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.chip nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			.chip.priority {
				border-color: var(--color-danger-transparent-300, rgba(255, 61, 113, 0.32));
				background: var(--color-danger-transparent-100, rgba(255, 61, 113, 0.12));
				color: var(--color-danger-500, #ff3d71);
			}
			.chip.status[data-status='OPEN'] {
				border-color: var(--color-info-transparent-300, rgba(0, 149, 255, 0.32));
				background: var(--color-info-transparent-100, rgba(0, 149, 255, 0.12));
				color: var(--color-info-500, #0095ff);
			}
			.chip.status[data-status='ANSWERED'],
			.chip.status[data-status='RESOLVED'] {
				border-color: var(--color-success-transparent-300, rgba(0, 214, 143, 0.32));
				background: var(--color-success-transparent-100, rgba(0, 214, 143, 0.12));
				color: var(--color-success-500, #00d68f);
			}
			.chip.due {
				border-color: var(--color-warning-transparent-300, rgba(255, 170, 0, 0.32));
				background: var(--color-warning-transparent-100, rgba(255, 170, 0, 0.12));
				color: var(--color-warning-500, #ffaa00);
			}
			.links {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
				margin-top: 0.625rem;
				padding-left: 2.625rem;
			}
			.link {
				display: inline-flex;
				align-items: center;
				gap: 0.3rem;
				height: 1.75rem;
				padding: 0 0.5rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				border-radius: 0.375rem;
				color: var(--gauzy-text-color-1, #222b45);
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				text-decoration: none;
				transition:
					border-color 0.12s ease,
					color 0.12s ease;
			}
			.link:hover {
				border-color: var(--color-primary-500, #6e49e8);
				color: var(--color-primary-500, #6e49e8);
				text-decoration: none;
			}
			.link nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}

			/* Kind avatar */
			.avatar {
				--tone: var(--gauzy-text-color-2, #8f9bb3);
				--tone-bg: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 2rem;
				height: 2rem;
				border-radius: 50%;
				color: var(--tone);
				background: var(--tone-bg);
			}
			.avatar nb-icon {
				width: 1rem;
				height: 1rem;
				font-size: 1rem;
			}

			/* Body */
			.detail-body {
				flex: 1;
				min-height: 0;
				overflow-y: auto;
				padding: 1rem 1rem 1rem 3.625rem;
			}
			.body {
				max-width: 72ch;
				white-space: pre-wrap;
				overflow-wrap: anywhere;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-1, #222b45);
				margin-bottom: 0.875rem;
			}
			/* An email's header: the sender, the mailbox it came to, its attachments */
			.mail-head {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				max-width: 72ch;
				padding-bottom: 0.75rem;
				margin-bottom: 0.875rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.sender {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 2rem;
				height: 2rem;
				border-radius: 50%;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.14));
				color: var(--gauzy-text-color-1, #222b45);
				font-size: 0.6875rem;
				font-weight: 600;
				letter-spacing: 0.02em;
			}
			.sender nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.mail-who {
				flex: 1;
				min-width: 0;
				line-height: 1.125rem;
			}
			.mail-from {
				display: flex;
				align-items: baseline;
				gap: 0.375rem;
				min-width: 0;
				font-size: 0.75rem;
			}
			.mail-name {
				font-weight: 600;
				color: var(--gauzy-text-color-1, #222b45);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.mail-address,
			.mail-to {
				min-width: 0;
				font-size: 0.6875rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.mail-attachments {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				flex-shrink: 0;
				height: 1.5rem;
				padding: 0 0.5rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.24));
				border-radius: 0.375rem;
				font-size: 0.6875rem;
				font-weight: 500;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.mail-attachments nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			/* A spam doubt: one quiet line, not a coloured box. */
			.mail-spam {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				max-width: 72ch;
				margin: -0.25rem 0 0.875rem;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.mail-spam nb-icon {
				flex-shrink: 0;
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
				color: var(--color-warning-500, #ffaa00);
			}

			/* Escalation details: an issue tracker's fields, label on the left, value on the right; neutral. */
			.fields {
				max-width: 72ch;
				margin: 0 0 1rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.24));
				border-radius: 0.5rem;
				overflow: hidden;
			}
			.field {
				display: grid;
				grid-template-columns: 8.5rem minmax(0, 1fr);
				gap: 0.75rem;
				padding: 0.5rem 0.75rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
			}
			.field + .field {
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.field dt {
				font-size: 0.6875rem;
				font-weight: 500;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.field dd {
				margin: 0;
				min-width: 0;
				color: var(--gauzy-text-color-1, #222b45);
				overflow-wrap: anywhere;
			}
			.field dd.decision {
				font-weight: 600;
			}
			/* What was tried: small numbered steps */
			.tried {
				margin: 0;
				padding: 0;
				list-style: none;
				counter-reset: tried;
			}
			.tried li {
				position: relative;
				padding-left: 1.5rem;
				counter-increment: tried;
			}
			.tried li + li {
				margin-top: 0.25rem;
			}
			.tried li::before {
				content: counter(tried);
				position: absolute;
				left: 0;
				top: 0.125rem;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1rem;
				height: 1rem;
				border-radius: 50%;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.14));
				color: var(--gauzy-text-color-2, #8f9bb3);
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			/* Confidence: ten thin segments; only the filled ones take the level's colour. */
			.confidence {
				display: flex;
				align-items: center;
				gap: 0.625rem;
			}
			.meter {
				display: inline-flex;
				gap: 2px;
			}
			.meter span {
				width: 0.375rem;
				height: 0.75rem;
				border-radius: 1px;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.18));
			}
			.confidence[data-level='low'] .meter span.on {
				background: var(--color-danger-500, #ff3d71);
			}
			.confidence[data-level='medium'] .meter span.on {
				background: var(--color-warning-500, #ffaa00);
			}
			.confidence[data-level='high'] .meter span.on {
				background: var(--color-success-500, #00d68f);
			}
			.confidence-value {
				font-size: 0.6875rem;
				font-weight: 600;
				font-variant-numeric: tabular-nums;
			}

			/* The answer: a reply under the message, as a thread shows it */
			.reply {
				display: flex;
				gap: 0.625rem;
				max-width: 72ch;
				margin-bottom: 0.875rem;
			}
			.reply-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 1.5rem;
				height: 1.5rem;
				border-radius: 50%;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.14));
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.reply-icon nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			.reply-content {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: 0.375rem;
				padding-top: 0.125rem;
			}
			.reply-meta {
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.choice {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				height: 1.375rem;
				padding: 0 0.625rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				border-radius: 999px;
				font-size: 0.6875rem;
				font-weight: 600;
				color: var(--gauzy-text-color-1, #222b45);
			}
			.choice-dot {
				width: 0.4375rem;
				height: 0.4375rem;
				border-radius: 50%;
				background: var(--color-primary-500, #6e49e8);
			}
			.choice[data-choice='approve'] .choice-dot {
				background: var(--color-success-500, #00d68f);
			}
			.choice[data-choice='reject'] .choice-dot {
				background: var(--color-danger-500, #ff3d71);
			}
			.reply-text {
				margin: 0;
				font-size: 0.75rem;
				line-height: 1.125rem;
				white-space: pre-wrap;
				overflow-wrap: anywhere;
				color: var(--gauzy-text-color-1, #222b45);
			}
			@media (max-width: 600px) {
				.field {
					grid-template-columns: minmax(0, 1fr);
					gap: 0.125rem;
				}
			}
			/* Activity: a thin timeline under the message */
			.activity {
				max-width: 72ch;
				margin-top: 1.25rem;
				padding-top: 0.75rem;
				border-top: 1px dashed var(--gauzy-border-default-color, rgba(126, 126, 143, 0.24));
			}
			.activity-title {
				margin: 0 0 0.5rem;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1rem;
				text-transform: uppercase;
				letter-spacing: 0.03em;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.timeline {
				margin: 0;
				padding: 0;
				list-style: none;
			}
			.step {
				position: relative;
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				padding: 0 0 0.5rem 1rem;
				font-size: 0.6875rem;
				line-height: 1rem;
			}
			.step::before {
				content: '';
				position: absolute;
				left: 0.1875rem;
				top: 0.625rem;
				bottom: -0.125rem;
				width: 1px;
				background: var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
			}
			.step:last-child {
				padding-bottom: 0;
			}
			.step:last-child::before {
				display: none;
			}
			.step-dot {
				position: absolute;
				left: 0;
				top: 0.25rem;
				width: 0.4375rem;
				height: 0.4375rem;
				border-radius: 50%;
				background: var(--gauzy-text-color-2, #8f9bb3);
			}
			.step[data-event='ANSWERED'] .step-dot,
			.step[data-event='DONE'] .step-dot {
				background: var(--color-success-500, #00d68f);
			}
			.step[data-event='SNOOZED'] .step-dot {
				background: var(--color-warning-500, #ffaa00);
			}
			.step[data-event='RECEIVED'] .step-dot {
				background: var(--color-primary-500, #6e49e8);
			}
			.step-label {
				font-weight: 500;
				color: var(--gauzy-text-color-1, #222b45);
			}
			.step-when {
				color: var(--gauzy-text-color-2, #8f9bb3);
				font-variant-numeric: tabular-nums;
			}

			.routed,
			.hint {
				margin-top: 0.25rem;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}

			/* Composer, pinned under the body */
			.composer {
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				padding: 0.625rem 1rem 0.75rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.options {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
			}
			.option {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				height: 1.75rem;
				padding: 0 0.625rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				border-radius: 0.375rem;
				background: none;
				color: var(--gauzy-text-color-1, #222b45);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				cursor: pointer;
				transition:
					background-color 0.12s ease,
					border-color 0.12s ease;
			}
			.option nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}
			/* One neutral look: the chosen option is told by its darker outline, a light fill and its check mark. */
			.option:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.08));
			}
			.option.chosen {
				border-color: var(--gauzy-text-color-1, #222b45);
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.14));
			}
			.recommended-label {
				font-size: 0.6875rem;
				font-weight: 400;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.label {
				margin: 0;
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.composer-box {
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				border-radius: 0.5rem;
				transition:
					border-color 0.12s ease,
					box-shadow 0.12s ease;
			}
			.composer-box:focus-within {
				border-color: var(--color-primary-500, #6e49e8);
				box-shadow: 0 0 0 2px var(--color-primary-transparent-200, rgba(110, 73, 232, 0.16));
			}
			/* The global textarea rule fixes every textarea at 102px, with a background of its own. */
			.composer-box textarea {
				display: block;
				width: 100%;
				height: auto;
				min-height: 3.5rem;
				max-height: 12rem;
				padding: 0.5rem 0.625rem 0.125rem;
				border: 0;
				border-radius: 0.5rem 0.5rem 0 0;
				box-shadow: none;
				outline: none;
				resize: vertical;
				background: transparent !important;
				color: var(--gauzy-text-color-1, #222b45);
				font: inherit;
				font-size: 0.75rem;
				line-height: 1.125rem;
			}
			.composer-box textarea::placeholder {
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.composer-actions {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.25rem 0.375rem 0.375rem 0.625rem;
			}
			.composer-actions [nbButton] {
				height: 1.75rem;
				font-size: 0.75rem;
			}
			.counter {
				font-size: 0.6875rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				font-variant-numeric: tabular-nums;
			}

			@media (max-width: 600px) {
				.tool-label {
					display: none;
				}
				.links {
					padding-left: 0;
				}
				.detail-body {
					padding-left: 1rem;
				}
				.title-row .when {
					display: none;
				}
			}
		`
	]
})
export class InboxItemDetailComponent {
	private readonly translate = inject(TranslateService);
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
	/** The snooze choices are shown. */
	readonly snoozeOpen = signal(false);

	readonly kindIcon = computed(() => kindIconOf(this.item().kind));

	readonly options = computed(() => optionsOf(this.item()));
	readonly escalation = computed(() => escalationDetails(this.item()));
	/** The confidence meter's ten segments, and the colour of its level: low under 40%, medium under 70%, else high. */
	protected readonly meterSegments = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	readonly confidenceLevel = computed(() => {
		const confidence = this.escalation().confidence ?? 0;
		return confidence < 40 ? 'low' : confidence < 70 ? 'medium' : 'high';
	});
	readonly links = computed(() => linksOf(this.item()));
	/** An email's sender, mailbox, attachments and spam verdict, for its header. */
	readonly emailHeader = computed(() => emailHeaderOf(this.item()));
	/** The item's history, under the message. */
	readonly activity = computed(() => activityOf(this.item()));
	readonly unread = computed(() => isUnread(this.item()));
	readonly archived = computed(() => isArchived(this.item()));
	readonly snoozed = computed(() => isSnoozed(this.item()));
	readonly done = computed(() => isDone(this.item()));
	/** The option chosen in the composer. */
	readonly chosenOption = computed(() => this.options().find((option) => option.id === this.optionId()) ?? null);
	/**
	 * The text the reply sends: the box's words, unless they are the chosen option's own (filled in by choosing it):
	 * the choice alone is sent then, so the answer does not say it twice and a required reason is still asked for.
	 */
	readonly replyText = computed(() => {
		const text = this.text().trim();
		const chosen = this.chosenOption();
		return chosen && text === this.optionText(chosen).trim() ? '' : text;
	});
	readonly problem = computed(() => replyProblem(this.item(), this.replyText(), this.optionId()));
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
	/** The (virtual) mailbox a source lists the item under, e.g. "Ever Works — Builder" for an agent's mail. */
	readonly mailboxLabel = computed(() => mailboxLabelOf(this.item()));
	/** Where the answer went: "Already decided in <source>" when the source had decided it first. */
	readonly routedNotice = computed(() => routedNoticeOf(this.item()));
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
				this.snoozeOpen.set(false);
			}
		});
	}

	/** Focus left the snooze menu (a click or tab elsewhere): it closes. */
	closeSnoozeOnBlur(event: FocusEvent): void {
		const anchor = event.currentTarget as HTMLElement | null;
		const next = event.relatedTarget as Node | null;
		if (!next || !anchor?.contains(next)) this.snoozeOpen.set(false);
	}

	/** Whether the label is a translation key (the default Approve / Reject). */
	isKey(label: string): boolean {
		return isTranslationKey(label);
	}

	/** An option's words as the reply box shows them (Approve / Reject translated). */
	optionText(option: IInboxItemOption): string {
		return isTranslationKey(option.label) ? this.translate.instant(option.label) : option.label;
	}

	/**
	 * A suggested reply: chosen, its words fill the reply box, to send as they are or to edit. A text the user wrote
	 * is never replaced; the words of the option chosen before are. Chosen again, it is dropped with its words.
	 */
	choose(option: IInboxItemOption): void {
		const before = this.chosenOption();
		const untouched = !this.text().trim() || (!!before && this.text() === this.optionText(before));
		if (before?.id === option.id) {
			this.optionId.set(null);
			if (untouched) this.text.set('');
			return;
		}
		this.optionId.set(option.id);
		if (untouched) this.text.set(this.optionText(option));
	}

	send(): void {
		if (this.problem() || this.busy()) return;
		const text = this.replyText();
		const optionId = this.optionId();
		this.replied.emit({ ...(text ? { text } : {}), ...(optionId ? { optionId } : {}) });
	}

	toggleRead(): void {
		this.stateChanged.emit({ isRead: this.unread() });
	}

	toggleArchive(): void {
		this.stateChanged.emit({ isArchived: !this.archived() });
	}

	/** Done hides the item from the open tabs (the Done tab keeps it); "not done" brings it back. */
	toggleDone(): void {
		this.stateChanged.emit({ isDone: !this.done() });
	}

	snooze(preset: InboxSnoozePreset): void {
		this.snoozeOpen.set(false);
		this.stateChanged.emit({ snoozedUntil: snoozeUntil(preset).toISOString() });
	}

	unsnooze(): void {
		this.stateChanged.emit({ snoozedUntil: null });
	}
}
