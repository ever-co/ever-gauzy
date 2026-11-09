// cspell:ignore unsnooze
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbIconModule } from '@nebular/theme';
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
							[attr.title]="(unread() ? 'INBOX.ACTIONS.MARK_READ' : 'INBOX.ACTIONS.MARK_UNREAD') | translate"
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
							[attr.title]="(archived() ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate"
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
							[attr.title]="(done() ? 'INBOX.ACTIONS.MARK_NOT_DONE' : 'INBOX.ACTIONS.MARK_DONE') | translate"
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
									[attr.title]="'INBOX.SNOOZE.MENU' | translate"
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
							<span class="chip" data-test="detail-source">{{
								isKey(sourceLabel()) ? (sourceLabel() | translate) : sourceLabel()
							}}</span>
							@if (mailboxLabel(); as mailbox) {
								<span class="chip" data-test="detail-mailbox">{{ mailbox }}</span>
							}
							@if (current.priority === 'high' || current.priority === 'urgent') {
								<span class="chip priority" data-test="detail-priority">{{
									'INBOX.PRIORITY.' + current.priority | translate
								}}</span>
							}
							<span class="chip status" [attr.data-status]="current.status">{{
								'INBOX.STATUS.' + current.status | translate
							}}</span>
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
						[attr.title]="current.createdAt | date: 'medium'"
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
					<ngx-inbox-email-viewer [text]="current.body" [title]="current.title"></ngx-inbox-email-viewer>
				} @else if (current.body) {
					<div class="body" data-test="detail-body">{{ current.body }}</div>
				}

				@if (current.kind === kinds.ESCALATION) {
					<div class="callout escalation" data-test="escalation">
						@if (escalation().decisionNeeded) {
							<div class="callout-section">
								<div class="callout-label">{{ 'INBOX.ESCALATION.DECISION' | translate }}</div>
								<div>{{ escalation().decisionNeeded }}</div>
							</div>
						}
						@if (escalation().attempted.length) {
							<div class="callout-section">
								<div class="callout-label">{{ 'INBOX.ESCALATION.ATTEMPTED' | translate }}</div>
								<ul>
									@for (attempt of escalation().attempted; track $index) {
										<li>{{ attempt }}</li>
									}
								</ul>
							</div>
						}
						@if (escalation().confidence !== null) {
							<div class="callout-section" data-test="confidence">
								<div class="callout-label">{{ 'INBOX.ESCALATION.CONFIDENCE' | translate }}</div>
								<div class="confidence">
									<span class="bar"><span [style.width.%]="escalation().confidence"></span></span>
									<span>{{ escalation().confidence }}%</span>
								</div>
							</div>
						}
					</div>
				}

				@if (current.response) {
					<div class="answer" data-test="answer">
						<div class="answer-head">
							<nb-icon icon="checkmark-circle-2-outline"></nb-icon>
							<span>{{
								'INBOX.ANSWERED' | translate: { date: (current.response.answeredAt | date: 'medium') }
							}}</span>
						</div>
						@if (answeredOption(); as option) {
							<div class="answer-option">
								{{ isKey(option.label) ? (option.label | translate) : option.label }}
							</div>
						}
						@if (current.response.text) {
							<div class="body">{{ current.response.text }}</div>
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
									[attr.title]="option.description ?? null"
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
				font-size: 0.9375rem;
				font-weight: 600;
				line-height: 1.375rem;
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
				--tone: var(--color-primary-500, #6e49e8);
				--tone-bg: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
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
			.avatar[data-kind='QUESTION'] {
				--tone: var(--color-info-500, #0095ff);
				--tone-bg: var(--color-info-transparent-100, rgba(0, 149, 255, 0.12));
			}
			.avatar[data-kind='APPROVAL'] {
				--tone: var(--color-success-500, #00d68f);
				--tone-bg: var(--color-success-transparent-100, rgba(0, 214, 143, 0.12));
			}
			.avatar[data-kind='ESCALATION'] {
				--tone: var(--color-danger-500, #ff3d71);
				--tone-bg: var(--color-danger-transparent-100, rgba(255, 61, 113, 0.12));
			}
			.avatar[data-kind='NOTIFICATION'] {
				--tone: var(--color-warning-500, #ffaa00);
				--tone-bg: var(--color-warning-transparent-100, rgba(255, 170, 0, 0.12));
			}
			.avatar[data-kind='NOTICE'] {
				--tone: var(--gauzy-text-color-2, #8f9bb3);
				--tone-bg: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
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
				font-size: 0.8125rem;
				line-height: 1.25rem;
				color: var(--gauzy-text-color-1, #222b45);
				margin-bottom: 0.875rem;
			}
			.callout {
				max-width: 72ch;
				display: flex;
				flex-direction: column;
				gap: 0.625rem;
				padding: 0.625rem 0.75rem;
				margin-bottom: 0.875rem;
				border: 1px solid var(--color-danger-transparent-300, rgba(255, 61, 113, 0.24));
				border-left-width: 2px;
				border-left-color: var(--color-danger-500, #ff3d71);
				border-radius: 0.375rem;
				background: var(--color-danger-transparent-100, rgba(255, 61, 113, 0.08));
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			.callout-label {
				margin-bottom: 0.125rem;
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				text-transform: uppercase;
				letter-spacing: 0.03em;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.callout ul {
				margin: 0;
				padding-left: 1rem;
			}
			.confidence {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				font-size: 0.75rem;
				font-weight: 600;
			}
			.bar {
				position: relative;
				width: 8rem;
				height: 0.25rem;
				border-radius: 999px;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				overflow: hidden;
			}
			.bar span {
				position: absolute;
				inset: 0 auto 0 0;
				border-radius: 999px;
				background: var(--color-danger-500, #ff3d71);
			}
			.answer {
				max-width: 72ch;
				padding: 0.625rem 0.75rem;
				margin-bottom: 0.875rem;
				border: 1px solid var(--color-success-transparent-300, rgba(0, 214, 143, 0.24));
				border-left-width: 2px;
				border-left-color: var(--color-success-500, #00d68f);
				border-radius: 0.375rem;
				background: var(--color-success-transparent-100, rgba(0, 214, 143, 0.08));
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			.answer-head {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				margin-bottom: 0.25rem;
				font-size: 0.75rem;
				font-weight: 600;
				line-height: 1rem;
				color: var(--color-success-500, #00d68f);
			}
			.answer-head nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}
			.answer-option {
				font-weight: 600;
				margin-bottom: 0.125rem;
			}
			.answer .body {
				margin-bottom: 0;
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
			.option:hover {
				border-color: var(--color-primary-500, #6e49e8);
			}
			.option.recommended {
				border-color: var(--color-info-500, #0095ff);
			}
			.option.chosen {
				border-color: var(--color-primary-500, #6e49e8);
				background: var(--color-primary-500, #6e49e8);
				color: #fff;
			}
			.recommended-label {
				font-size: 0.6875rem;
				font-weight: 400;
				opacity: 0.85;
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
				font-size: 0.8125rem;
				line-height: 1.25rem;
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
	readonly links = computed(() => linksOf(this.item()));
	readonly unread = computed(() => isUnread(this.item()));
	readonly archived = computed(() => isArchived(this.item()));
	readonly snoozed = computed(() => isSnoozed(this.item()));
	readonly done = computed(() => isDone(this.item()));
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
