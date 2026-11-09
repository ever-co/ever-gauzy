import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, skip, switchMap } from 'rxjs/operators';
import {
	IInboxItemCounts,
	IInboxItemWithState,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	InboxItemKindEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import { INBOX_MY_MAILBOX_LINK, INBOX_UI_PAGE_SIZE } from '../../inbox-ui.constants';
import {
	apiTabOf,
	kindIconOf,
	INBOX_UI_TAB_ICONS,
	INBOX_UI_TABS,
	InboxUiTab,
	listedIn,
	isTranslationKey,
	isUnread,
	listDateFormat,
	previewOf,
	replaceItem,
	sourceLabelOf
} from '../../inbox-ui.helpers';
import { InboxEmailAvailabilityService } from '../../services/inbox-email-availability.service';
import { InboxUiService } from '../../services/inbox-ui.service';
import { InboxItemDetailComponent } from '../inbox-item-detail/inbox-item-detail.component';
import { InboxNotificationsComponent } from '../inbox-notifications/inbox-notifications.component';

/** What the page shows. */
export type InboxPageView = 'loading' | 'ready' | 'unavailable' | 'error';

/** The message of an API refusal, for the reply pane ("Already decided in Ever Works", …). */
export function apiMessage(error: unknown): string | null {
	const body = (error as HttpErrorResponse)?.error;
	const message = body?.message ?? (error as HttpErrorResponse)?.message;
	if (Array.isArray(message)) return message.join(' ');
	return typeof message === 'string' && message.trim() ? message : null;
}

/**
 * `/pages/inbox` (plan 04 §1, G-P3-2): everything addressed to me. Tabs All, Decisions, Email, Notifications
 * Done and Archived, each with my count where the API counts it (unread, open decisions, unread email); filters
 * (kind, source, unread only, text); a list and the detail pane of the selected item.
 *
 * The page asks the API first. A 404 means this installation's API does not load the Inbox
 * (`GAUZY_INBOX_ENABLED` is not `true`, the default): the page says so and makes no other request.
 */
@Component({
	selector: 'ngx-inbox-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		RouterLink,
		TranslatePipe,
		InboxItemDetailComponent,
		InboxNotificationsComponent
	],
	template: `
		<nb-card class="inbox" data-test="inbox-page">
			<nb-card-header class="inbox-header">
				<div class="heading">
					<span class="heading-icon" aria-hidden="true"><nb-icon icon="inbox-outline"></nb-icon></span>
					<div class="heading-text">
						<h4>{{ 'INBOX.TITLE' | translate }}</h4>
						@if (view() === 'ready' && unreadTotal(); as unreadCount) {
							<span class="subtitle" data-test="unread-summary">{{
								'INBOX.UNREAD_SUMMARY' | translate: { count: unreadCount }
							}}</span>
						} @else {
							<span class="subtitle">{{ 'INBOX.SUBTITLE' | translate }}</span>
						}
					</div>
				</div>
				<div class="header-actions">
					@if (emailAvailable()) {
						<a nbButton ghost size="small" data-test="my-mailbox" [routerLink]="myMailboxLink">
							<nb-icon icon="email-outline"></nb-icon>
							{{ 'INBOX.MY_MAILBOX.LINK' | translate }}
						</a>
					}
					@if (view() === 'ready' && tab() !== 'notifications') {
						<button
							nbButton
							size="small"
							status="primary"
							outline
							data-test="mark-all-read"
							[disabled]="loading() || !hasUnread()"
							(click)="markAllRead()"
						>
							<nb-icon icon="done-all-outline"></nb-icon>
							{{ 'INBOX.ACTIONS.MARK_ALL_READ' | translate }}
						</button>
					}
				</div>
			</nb-card-header>
			<nb-card-body class="inbox-body">
				@switch (view()) {
					@case ('unavailable') {
						<div class="state" data-test="unavailable">
							<span class="state-icon"><nb-icon icon="inbox-outline"></nb-icon></span>
							<p>{{ 'INBOX.UNAVAILABLE' | translate }}</p>
						</div>
					}
					@case ('error') {
						<div class="state">
							<nb-alert status="danger" role="alert" data-test="error">{{ 'INBOX.ERROR' | translate }}</nb-alert>
							<button nbButton size="small" status="primary" (click)="reload()">
								<nb-icon icon="refresh-outline"></nb-icon>
								{{ 'INBOX.RETRY' | translate }}
							</button>
						</div>
					}
					@case ('loading') {
						<div class="loading" data-test="loading" [nbSpinner]="true"></div>
					}
					@default {
						<!-- The task page's tab bar: an icon before each label, the open tab underlined. -->
						<div class="tab-row">
							<div class="tabs" role="tablist" [attr.aria-label]="'INBOX.TITLE' | translate">
								@for (entry of tabs; track entry) {
									<button
										type="button"
										class="tab"
										role="tab"
										[attr.aria-selected]="tab() === entry"
										[attr.data-test]="'tab-' + entry"
										[class.is-active]="tab() === entry"
										(click)="selectTab(entry)"
									>
										<nb-icon [icon]="tabIcons[entry]" aria-hidden="true"></nb-icon>
										{{ 'INBOX.TABS.' + entry | translate }}
										@if (tabCount(entry); as count) {
											<span class="tab-count" [attr.data-test]="'count-' + entry">{{ count }}</span>
										}
									</button>
								}
							</div>
						</div>

						@if (actionError(); as message) {
							<nb-alert
								class="action-error"
								status="danger"
								role="alert"
								closable
								data-test="action-error"
								(close)="actionError.set(null)"
								>{{ isKey(message) ? (message | translate) : message }}</nb-alert
							>
						}

						@if (tab() === 'notifications') {
							<div class="notifications-pane">
								<ngx-inbox-notifications></ngx-inbox-notifications>
							</div>
						} @else {
							<div class="panes" [class.has-selection]="!!selected()">
								<section class="list-pane">
									<div class="filters" data-test="filters">
										<label class="search">
											<nb-icon icon="search-outline" aria-hidden="true"></nb-icon>
											<input
												nbInput
												fullWidth
												class="search-input"
												fieldSize="small"
												type="search"
												data-test="filter-q"
												maxlength="200"
												[attr.aria-label]="'INBOX.FILTERS.SEARCH' | translate"
												[placeholder]="'INBOX.FILTERS.SEARCH' | translate"
												[ngModel]="query()"
												(ngModelChange)="search$.next($event)"
											/>
										</label>
										<div class="filter-row">
											<nb-select
												size="small"
												data-test="filter-kind"
												[placeholder]="'INBOX.FILTERS.KIND' | translate"
												[selected]="kind()"
												(selectedChange)="setKind($event)"
											>
												<nb-option [value]="null">{{ 'INBOX.FILTERS.ALL_KINDS' | translate }}</nb-option>
												@for (value of kindOptions; track value) {
													<nb-option [value]="value">{{ 'INBOX.KIND.' + value | translate }}</nb-option>
												}
											</nb-select>
											<nb-select
												size="small"
												data-test="filter-source"
												[placeholder]="'INBOX.FILTERS.SOURCE' | translate"
												[selected]="source()"
												(selectedChange)="setSource($event)"
											>
												<nb-option [value]="null">{{ 'INBOX.FILTERS.ALL_SOURCES' | translate }}</nb-option>
												@for (value of sourceOptions; track value) {
													<nb-option [value]="value">{{ sourceLabel(value) | translate }}</nb-option>
												}
											</nb-select>
											<nb-checkbox
												class="unread-toggle"
												data-test="filter-unread"
												[checked]="unreadOnly()"
												(checkedChange)="setUnread($event)"
											>
												{{ 'INBOX.FILTERS.UNREAD' | translate }}
											</nb-checkbox>
										</div>
									</div>

									<div class="list" data-test="list" [nbSpinner]="loading()" nbSpinnerSize="small">
										@for (item of items(); track item.id) {
											<div
												class="row"
												role="button"
												tabindex="0"
												[class.selected]="item.id === selectedId()"
												[class.unread]="unread(item)"
												[attr.aria-current]="item.id === selectedId() ? 'true' : null"
												[attr.data-test]="'item-' + item.id"
												(click)="open(item)"
												(keydown.enter)="open(item)"
											>
												<span class="unread-dot" aria-hidden="true"></span>
												<span class="avatar" [attr.data-kind]="item.kind" aria-hidden="true">
													<nb-icon [icon]="kindIcon(item.kind)"></nb-icon>
												</span>
												<div class="row-main">
													<div class="row-top">
														<span class="row-title">{{ item.title }}</span>
														<time
															class="when"
															[attr.datetime]="item.createdAt"
															[attr.title]="item.createdAt | date: 'medium'"
															>{{ item.createdAt | date: listDate(item.createdAt) }}</time
														>
													</div>
													@if (preview(item); as text) {
														<div class="row-preview">{{ text }}</div>
													}
													<div class="row-meta">
														<span class="tag">{{ 'INBOX.KIND.' + item.kind | translate }}</span>
														<span class="source">{{
															isKey(sourceLabel(item.source))
																? (sourceLabel(item.source) | translate)
																: item.source
														}}</span>
														@if (item.priority === 'high' || item.priority === 'urgent') {
															<span class="tag priority">{{
																'INBOX.PRIORITY.' + item.priority | translate
															}}</span>
														}
													</div>
												</div>
											</div>
										} @empty {
											@if (!loading()) {
												<div class="state compact" data-test="empty">
													<span class="state-icon"><nb-icon icon="inbox-outline"></nb-icon></span>
													<strong>{{ 'INBOX.EMPTY' | translate }}</strong>
													<span class="state-hint">{{ 'INBOX.EMPTY_HINT' | translate }}</span>
												</div>
											}
										}
										@if (nextCursor()) {
											<div class="load-more">
												<button
													nbButton
													ghost
													size="small"
													status="primary"
													data-test="load-more"
													[disabled]="loading()"
													(click)="more()"
												>
													{{ 'INBOX.LOAD_MORE' | translate }}
												</button>
											</div>
										}
									</div>
								</section>

								<section class="detail-pane">
									@if (selected(); as item) {
										<button
											type="button"
											class="back"
											data-test="back"
											(click)="closeDetail()"
										>
											<nb-icon icon="arrow-back-outline"></nb-icon>
											{{ 'INBOX.BACK' | translate }}
										</button>
										<ngx-inbox-item-detail
											[item]="item"
											[busy]="busy() || isReplying(item)"
											[error]="replyError()"
											(replied)="reply(item, $event)"
											(stateChanged)="changeState(item, $event)"
										></ngx-inbox-item-detail>
									} @else {
										<div class="state" data-test="no-selection">
											<span class="state-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
											<strong>{{ 'INBOX.SELECT' | translate }}</strong>
											<span class="state-hint">{{ 'INBOX.SELECT_HINT' | translate }}</span>
										</div>
									}
								</section>
							</div>
						}
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.inbox {
				margin-bottom: 0;
				overflow: hidden;
			}

			/* Header */
			.inbox-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 1rem;
				flex-wrap: wrap;
				padding: 1rem 1.25rem;
			}
			.heading {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				min-width: 0;
			}
			.heading-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.5rem;
				height: 2.5rem;
				border-radius: 0.75rem;
				color: var(--color-primary-500, #6e49e8);
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
				font-size: 1.25rem;
				flex-shrink: 0;
			}
			.heading-text {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.heading-text h4 {
				margin: 0;
				font-size: 1.25rem;
				line-height: 1.3;
			}
			.subtitle {
				font-size: 0.8125rem;
				color: var(--text-hint-color, #8f9bb3);
			}
			.header-actions {
				display: flex;
				gap: 0.5rem;
				align-items: center;
				flex-wrap: wrap;
			}

			.inbox-body {
				padding: 0;
				overflow: hidden;
			}

			/* Tabs: the task page's tab bar (the employee page's, with an icon before each label) */
			.tab-row {
				display: flex;
				align-items: flex-end;
				padding: 0 1.25rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 1rem;
			}
			.tab {
				position: relative;
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0.5rem 0.125rem 0.625rem;
				border: 0;
				background: transparent;
				font: inherit;
				font-size: 0.8125rem;
				font-weight: 500;
				line-height: 1.25rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				cursor: pointer;
				transition: color 0.12s ease-in-out;
			}
			.tab::after {
				content: '';
				position: absolute;
				inset-inline: 0;
				bottom: -1px;
				height: 2px;
				border-radius: 2px 2px 0 0;
				background-color: transparent;
			}
			.tab:hover {
				color: var(--gauzy-text-color-1, #222b45);
			}
			.tab:focus-visible {
				outline: 2px solid var(--gauzy-action-info-text, #0095ff);
				outline-offset: 2px;
			}
			.tab.is-active {
				color: var(--color-primary-500, #6e49e8);
			}
			.tab.is-active::after {
				background-color: var(--color-primary-500, #6e49e8);
			}
			.tab nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
			}
			.tab-count {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.25rem;
				height: 1.125rem;
				padding: 0 0.375rem;
				border-radius: 999px;
				background-color: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				font-size: 0.6875rem;
				font-weight: 500;
				line-height: 1;
				color: var(--gauzy-text-color-2, #8f9bb3);
				font-variant-numeric: tabular-nums;
			}

			.action-error {
				margin: 0.75rem 1rem 0;
			}
			.notifications-pane {
				padding: 0;
			}

			/* Two panes, mail-app style */
			.panes {
				display: grid;
				grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
				height: clamp(30rem, calc(100vh - 17rem), 64rem);
			}
			.list-pane {
				display: flex;
				flex-direction: column;
				min-width: 0;
				min-height: 0;
				border-right: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}

			/* Search and filters, at the task page's control size (1.75rem) */
			.filters {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 0.625rem 0.75rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.search {
				position: relative;
				display: block;
				margin: 0;
				line-height: normal;
			}
			.search nb-icon {
				position: absolute;
				left: 0.5rem;
				top: 50%;
				transform: translateY(-50%);
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				pointer-events: none;
				z-index: 1;
			}
			/* The global input floor draws every input 46px tall, with !important. */
			.search input.search-input {
				min-height: 1.875rem !important;
				height: 1.875rem;
				padding: 0 0.625rem 0 1.75rem;
				border-radius: 0.375rem;
				font-size: 0.75rem;
				line-height: 1rem;
			}
			.search input.search-input::placeholder {
				font-size: 0.75rem;
			}
			.filter-row {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
			}
			.filter-row nb-select {
				flex: 1 1 0;
				min-width: 0;
				max-width: none;
			}
			/* Matched to Nebular's own nb-select.appearance-outline.size-small, as the task page does. */
			.filter-row nb-select.appearance-outline.status-basic.size-small ::ng-deep .select-button {
				min-width: 0 !important;
				min-height: 1.75rem !important;
				height: 1.75rem;
				padding: 0 1.5rem 0 0.5rem;
				border-radius: 0.375rem;
				font-size: 0.75rem;
				line-height: 1rem;
				font-weight: 500;
			}
			.filter-row nb-select.appearance-outline.status-basic.size-small ::ng-deep .select-button nb-icon {
				right: 0.25rem;
				font-size: 0.875rem;
			}
			.unread-toggle {
				flex: 0 0 auto;
				white-space: nowrap;
			}
			.unread-toggle ::ng-deep .custom-checkbox {
				width: 1rem;
				height: 1rem;
			}
			.unread-toggle ::ng-deep .text {
				padding-inline-start: 0.375rem;
				font-size: 0.75rem;
				font-weight: 500;
				line-height: 1rem;
				color: var(--gauzy-text-color-1, #222b45);
			}

			/* Message list */
			.list {
				flex: 1;
				min-height: 0;
				overflow-x: hidden;
				overflow-y: auto;
				padding: 0.25rem;
			}
			.row {
				position: relative;
				display: flex;
				gap: 0.625rem;
				align-items: flex-start;
				min-width: 0;
				padding: 0.5rem 0.625rem 0.5rem 0.875rem;
				border-radius: 0.5rem;
				cursor: pointer;
				outline: none;
				transition: background-color 0.12s ease;
			}
			.row + .row {
				margin-top: 1px;
			}
			.row:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.08));
			}
			.row:focus-visible {
				box-shadow: inset 0 0 0 2px var(--color-primary-500, #6e49e8);
			}
			.row.selected {
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
			}
			.row.selected::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0.5rem;
				bottom: 0.5rem;
				width: 2px;
				border-radius: 2px;
				background: var(--color-primary-500, #6e49e8);
			}
			.unread-dot {
				position: absolute;
				left: 0.3rem;
				top: 1.125rem;
				width: 0.375rem;
				height: 0.375rem;
				border-radius: 50%;
				background: var(--color-primary-500, #6e49e8);
				opacity: 0;
			}
			.row.unread .unread-dot {
				opacity: 1;
			}
			.row-main {
				flex: 1;
				min-width: 0;
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
			}
			.row-top {
				display: flex;
				align-items: baseline;
				gap: 0.5rem;
				min-width: 0;
			}
			.row-title {
				flex: 1;
				min-width: 0;
				font-size: 0.8125rem;
				font-weight: 500;
				line-height: 1.125rem;
				color: var(--gauzy-text-color-1, #222b45);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.row.unread .row-title {
				font-weight: 600;
			}
			.when {
				flex-shrink: 0;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				font-variant-numeric: tabular-nums;
			}
			.row.unread .when {
				color: var(--color-primary-500, #6e49e8);
				font-weight: 600;
			}
			.row-preview {
				min-width: 0;
				font-size: 0.75rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.row-meta {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
				margin-top: 0.125rem;
				font-size: 0.6875rem;
				line-height: 1rem;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.row-meta .source {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.tag {
				flex-shrink: 0;
				padding: 0 0.375rem;
				border-radius: 0.1875rem;
				line-height: 1rem;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-2, #8f9bb3);
				font-weight: 500;
			}
			.tag.priority {
				background: var(--color-danger-transparent-200, rgba(255, 61, 113, 0.16));
				color: var(--color-danger-500, #ff3d71);
			}
			.load-more {
				display: flex;
				justify-content: center;
				padding: 0.375rem;
			}


			/* Kind avatars (also used by the detail pane) */
			.avatar {
				--tone: var(--color-primary-500, #6e49e8);
				--tone-bg: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.12));
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 1.75rem;
				height: 1.75rem;
				border-radius: 50%;
				color: var(--tone);
				background: var(--tone-bg);
				font-size: 0.875rem;
			}
			.avatar nb-icon {
				width: 0.875rem;
				height: 0.875rem;
				font-size: 0.875rem;
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
				--tone: var(--text-hint-color, #8f9bb3);
				--tone-bg: var(--background-basic-color-3, #edf1f7);
			}

			/* Reading pane */
			.detail-pane {
				min-width: 0;
				min-height: 0;
				display: flex;
				flex-direction: column;
				background: var(--background-basic-color-1, #fff);
			}
			.detail-pane ngx-inbox-item-detail {
				flex: 1;
				min-height: 0;
				display: flex;
				flex-direction: column;
			}
			.back {
				display: none;
				align-items: center;
				gap: 0.35rem;
				margin: 0.5rem 0.75rem 0;
				padding: 0.35rem 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: var(--color-primary-500, #6e49e8);
				font: inherit;
				font-size: 0.8125rem;
				font-weight: 600;
				cursor: pointer;
				align-self: flex-start;
			}

			/* Empty, unavailable and "select an item" states */
			.state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
				height: 100%;
				min-height: 14rem;
				padding: 2rem 1.5rem;
				text-align: center;
				color: var(--text-basic-color, #222b45);
			}
			.state.compact {
				min-height: 12rem;
				height: auto;
			}
			.state p {
				margin: 0;
				max-width: 28rem;
			}
			.state-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 3.5rem;
				height: 3.5rem;
				margin-bottom: 0.25rem;
				border-radius: 50%;
				background: var(--background-basic-color-2, #f7f9fc);
				color: var(--text-hint-color, #8f9bb3);
				font-size: 1.6rem;
			}
			.state-hint {
				max-width: 22rem;
				font-size: 0.8125rem;
				color: var(--text-hint-color, #8f9bb3);
			}
			.loading {
				min-height: 16rem;
			}

			/* Narrow screens: the list, or the open item with a way back */
			@media (max-width: 960px) {
				.panes {
					grid-template-columns: minmax(0, 1fr);
					height: auto;
					min-height: 28rem;
				}
				.list-pane {
					border-right: 0;
				}
				.list {
					max-height: 70vh;
				}
				.panes.has-selection .list-pane {
					display: none;
				}
				.panes:not(.has-selection) .detail-pane {
					display: none;
				}
				.back {
					display: inline-flex;
				}
			}
		`
	]
})
export class InboxPageComponent implements OnInit {
	private readonly api = inject(InboxUiService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly tabs = INBOX_UI_TABS;
	protected readonly tabIcons = INBOX_UI_TAB_ICONS;
	protected readonly myMailboxLink = INBOX_MY_MAILBOX_LINK;
	/** "My mailbox" is linked only where the API serves the Inbox email features. */
	readonly emailAvailable = toSignal(inject(InboxEmailAvailabilityService).available$, { initialValue: false });
	protected readonly kindOptions = Object.values(InboxItemKindEnum);
	protected readonly sourceOptions = Object.values(InboxItemSourceEnum);

	readonly view = signal<InboxPageView>('loading');
	readonly tab = signal<InboxUiTab>('all');
	readonly kind = signal<InboxItemKindEnum | null>(null);
	readonly source = signal<string | null>(null);
	readonly unreadOnly = signal(false);
	readonly query = signal('');
	readonly items = signal<IInboxItemWithState[]>([]);
	readonly nextCursor = signal<string | null>(null);
	readonly loading = signal(false);
	/** My counts, beside the tabs: read with the availability check, and again after the page changed an item. */
	readonly counts = signal<IInboxItemCounts | null>(null);
	/** My unread items, under the page's title (none: the title's subtitle instead). */
	readonly unreadTotal = computed(() => {
		const unread = Number(this.counts()?.unread) || 0;
		return unread > 0 ? unread : null;
	});
	readonly selectedId = signal<string | null>(null);
	/** A read / archive / snooze change is on its way. */
	readonly busy = signal(false);
	/**
	 * The items whose reply is on its way, and the reply errors, by item: a reply is tracked for its own item, so a
	 * state change of another item never re-enables its Send, and its error never lands on another item (review F67).
	 */
	private readonly replying = signal<ReadonlySet<string>>(new Set());
	private readonly replyErrors = signal<Readonly<Record<string, string | null>>>({});
	/** The open item's reply error. */
	readonly replyError = computed(() => {
		const id = this.selectedId();
		return id ? (this.replyErrors()[id] ?? null) : null;
	});
	/** Why the last read / archive / snooze failed (the API's message, or a translation key). */
	readonly actionError = signal<string | null>(null);

	/**
	 * The open item, kept here as well: an item read under "unread only" leaves the list but stays open (its
	 * body and reply form must not vanish while the user reads it).
	 */
	private readonly opened = signal<IInboxItemWithState | null>(null);
	readonly selected = computed(() => {
		const id = this.selectedId();
		if (!id) return null;
		const opened = this.opened();
		return this.items().find((item) => item.id === id) ?? (opened?.id === id ? opened : null);
	});
	/**
	 * Something to mark read: an unread item listed, or more pages to load (older items, which may be unread: the API
	 * marks them all, so the button does not wait for "Load more", review F69).
	 */
	readonly hasUnread = computed(
		() => this.items().some((item) => isUnread(item)) || (!this.markedAll() && !!this.nextCursor())
	);
	/** "Mark all read" went through for the list as it is: its older pages are read too (#11098 review). */
	private readonly markedAll = signal(false);
	/** Counts the changes of the list's tab and filters: a mark-all answered after one is not this list's. */
	private listScope = 0;

	/** The search box, debounced into `query`. */
	readonly search$ = new Subject<string>();
	/** `false`: a fresh first page; `true`: the next page after `nextCursor`. */
	private readonly load$ = new Subject<boolean>();
	/** `?item=` of the URL, opened once the Inbox is served (then forgotten, unless it could not be opened yet). */
	private requestedItemId: string | null = null;
	/** The read of the latest `?item=` link still on its way (a later link cancels it). */
	private linkRead: Subscription | null = null;
	/** The item open when the pending link arrived: a link never replaces an item opened after it. */
	private selectedAtLink: string | null = null;

	ngOnInit(): void {
		this.readRequestedTab();
		this.requestedItemId = this.route.snapshot.queryParamMap.get('item')?.trim() || null;
		this.setUpListStream();
		this.setUpSearch();
		this.followItemLinks();
		this.followCounts();
		this.checkAvailability();
	}

	/** The tabs' counts follow my changes (the signal the header badge follows too). A failed read keeps the last. */
	private followCounts(): void {
		this.api.changed$
			.pipe(
				switchMap(() => this.api.counts().pipe(catchError(() => EMPTY))),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((counts) => this.counts.set(counts));
	}

	/** The count a tab shows beside its name: my unread items (All), the open decisions, the unread email; none for the rest. */
	tabCount(tab: InboxUiTab): number | null {
		const counts = this.counts();
		if (!counts) return null;
		const value =
			tab === 'all'
				? counts.unread
				: tab === 'decisions'
					? counts.decisionsOpen
					: tab === 'email'
						? // Every unread email item (`emailUnread`); an older API answers the mailboxes' counts only.
							(counts.emailUnread ?? (counts.byMailbox ?? []).reduce((sum, mailbox) => sum + (Number(mailbox.unread) || 0), 0))
						: null;
		return value && value > 0 ? value : null;
	}

	/** A later `?item=` while the page stays (the router reuses it for another link): opened like the first one. */
	private followItemLinks(): void {
		this.route.queryParamMap
			.pipe(
				map((params) => params.get('item')?.trim() || null),
				distinctUntilChanged(),
				// The first value is the one read above.
				skip(1),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((id) => {
				// Every change of the link ends the read of the one before; a link removed (another tab chosen) opens nothing.
				this.linkRead?.unsubscribe();
				this.linkRead = null;
				this.requestedItemId = id;
				this.selectedAtLink = this.selectedId();
				// Before the Inbox is served, or while its list is being read, the list's answer opens it.
				if (id && this.view() === 'ready' && !this.loading()) this.openRequestedItem();
			});
	}

	/** `?tab=` of the URL, when it names one of the tabs. */
	private readRequestedTab(): void {
		const requested = this.route.snapshot.queryParamMap.get('tab') as InboxUiTab | null;
		if (requested && INBOX_UI_TABS.includes(requested)) this.tab.set(requested);
	}

	/**
	 * Asks the API first (the counts route): only where it serves the Inbox does the page show anything else,
	 * the Notifications tab included. 404 / 403 → the "off" notice.
	 */
	private checkAvailability(): void {
		this.api
			.counts()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (counts) => {
					this.counts.set(counts);
					this.view.set('ready');
					// The list first: its answer opens a linked item (so the list never lands over the fresher item read).
					this.reload();
				},
				error: (error: HttpErrorResponse) =>
					this.view.set(error?.status === 404 || error?.status === 403 ? 'unavailable' : 'error')
			});
	}

	/**
	 * The deep link `?item=<id>` (an Ever Works copy of an item links back here): the item opens as a click on its row
	 * opens it (an unread one becomes read), whichever tab it is listed in, but only while its detail can be shown: not
	 * once the list failed (the retry opens it) or the Notifications tab is chosen, nor over an item I opened meanwhile.
	 * An id the API does not show me (404: not mine, gone) is ignored quietly; any other failure to read it is said, and
	 * the link is kept for the next try (a retry of the page, or the link followed again). Only the latest link counts:
	 * a link followed while an earlier one is still being read cancels that read.
	 */
	private openRequestedItem(): void {
		const id = this.requestedItemId;
		this.requestedItemId = null;
		if (!id) return;
		this.linkRead?.unsubscribe();
		// Counted from the link's arrival (it may have waited for the list), not from this read.
		const selectedBefore = this.selectedAtLink;
		this.linkRead = this.api
			.get(id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (item) => {
					if (!item?.id || this.selectedId() !== selectedBefore) return;
					if (this.view() !== 'ready') {
						this.requestedItemId = id;
						return;
					}
					if (this.tab() === 'notifications') return;
					// The link works now: an earlier failure to open it is no longer news.
					if (this.actionError() === 'INBOX.ITEM_LINK_ERROR') this.actionError.set(null);
					// The detail shows the item as just read, also when the list holds an older copy of it.
					this.items.update((items) => items.map((entry) => (entry.id === item.id ? item : entry)));
					this.open(item);
				},
				error: (error: HttpErrorResponse) => {
					// An item opened meanwhile makes the link obsolete: no alert, nothing kept for a retry.
					if (this.selectedId() !== selectedBefore) return;
					if (error?.status === 404 || error?.status === 403) return;
					this.requestedItemId = id;
					this.actionError.set('INBOX.ITEM_LINK_ERROR');
				}
			});
	}

	/** One list request at a time: a new tab, filter or page replaces the one in flight. */
	private setUpListStream(): void {
		this.load$
			.pipe(
				switchMap((append) => {
					const apiTab = apiTabOf(this.tab());
					if (!apiTab || this.view() !== 'ready') return EMPTY;
					this.loading.set(true);
					return this.api
						.list({
							tab: apiTab,
							kind: this.kind() ?? undefined,
							source: this.source() ?? undefined,
							unread: this.unreadOnly() || undefined,
							q: this.query().trim() || undefined,
							cursor: append ? (this.nextCursor() ?? undefined) : undefined,
							limit: INBOX_UI_PAGE_SIZE
						})
						.pipe(
							// Paired with the page it asked for.
							map((page) => ({ page, append })),
							// Caught here, so the stream stays alive for a retry.
							catchError((error: HttpErrorResponse) => {
								this.loading.set(false);
								this.view.set(error?.status === 404 || error?.status === 403 ? 'unavailable' : 'error');
								return EMPTY;
							})
						);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ page, append }) => {
				this.loading.set(false);
				const items = page?.items ?? [];
				this.items.set(append ? [...this.items(), ...items] : items);
				this.nextCursor.set(page?.nextCursor ?? null);
				// A fresh page without the selected item closes it, unless it is the item I have open (read under
				// "unread only", then the list started over): that one stays open.
				const id = this.selectedId();
				if (!append && id && !items.some((item) => item.id === id) && this.opened()?.id !== id) {
					this.selectedId.set(null);
				}
				// A linked item waiting for the list (its first page, a page loaded while it waited, or the retry after a failure)
				// is read now.
				if (this.requestedItemId) this.openRequestedItem();
			});
	}

	/** The search box, debounced. */
	private setUpSearch(): void {
		this.search$
			.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
			.subscribe((value) => {
				this.listChanged();
				this.query.set(value ?? '');
				this.reload();
			});
	}

	reload(): void {
		if (this.view() === 'error') {
			// A retry after a failure starts over with the availability check.
			this.view.set('loading');
			this.checkAvailability();
			return;
		}
		this.load$.next(false);
	}

	more(): void {
		if (this.nextCursor()) this.load$.next(true);
	}

	selectTab(tab: InboxUiTab): void {
		if (tab === this.tab()) return;
		this.listChanged();
		this.tab.set(tab);
		this.items.set([]);
		this.nextCursor.set(null);
		this.selectedId.set(null);
		void this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, replaceUrl: true });
		this.reload();
	}

	setKind(kind: InboxItemKindEnum | null): void {
		this.listChanged();
		this.kind.set(kind);
		this.reload();
	}

	setSource(source: string | null): void {
		this.listChanged();
		this.source.set(source);
		this.reload();
	}

	setUnread(unread: boolean): void {
		this.listChanged();
		this.unreadOnly.set(!!unread);
		this.reload();
	}

	unread(item: IInboxItemWithState): boolean {
		return isUnread(item);
	}

	sourceLabel(source: string): string {
		return sourceLabelOf(source);
	}

	isKey(label: string): boolean {
		return isTranslationKey(label);
	}

	/** The icon of a row's avatar. */
	kindIcon(kind: string): string {
		return kindIconOf(kind);
	}

	/** A row's time, as messaging apps show it (the full date and time on hover). */
	listDate(createdAt: Date | string | null | undefined): string {
		return listDateFormat(createdAt);
	}

	/** The line of the body under a row's title. */
	preview(item: IInboxItemWithState): string {
		return previewOf(item.body);
	}

	/** Back to the list (narrow screens, where the open item replaces the list). */
	closeDetail(): void {
		this.selectedId.set(null);
	}

	/** Whether a reply to this item is on its way. */
	isReplying(item: IInboxItemWithState): boolean {
		return !!item.id && this.replying().has(item.id);
	}

	/** Opens an item; an unread one becomes read. */
	open(item: IInboxItemWithState): void {
		this.selectedId.set(item.id ?? null);
		this.opened.set(item);
		// A reply error stays with its item (shown again when it is opened again): the next reply clears it.
		if (item.id && isUnread(item)) this.changeState(item, { isRead: true });
	}

	reply(item: IInboxItemWithState, input: IInboxReplyInput): void {
		const id = item.id;
		if (!id || this.replying().has(id)) return;
		this.setReplying(id, true);
		this.setReplyError(id, null);
		this.api.reply(id, input).subscribe({
			next: (next) => {
				this.setReplying(id, false);
				this.useAnswered(next);
				this.api.notifyChanged();
			},
			error: (error: HttpErrorResponse) => {
				this.setReplying(id, false);
				this.setReplyError(id, apiMessage(error));
				// "Already decided" (409): show what the source decided.
				if (error?.status === 409) this.refresh(id);
			}
		});
	}

	/**
	 * An item as the API answers it now. An answered decision is no longer a decision: it leaves the Decisions tab
	 * (and stays open), as the API's list no longer has it (review F66), also when it was decided elsewhere first.
	 */
	private useAnswered(next: IInboxItemWithState): void {
		if (this.opened()?.id === next.id) this.opened.set(next);
		if (this.tab() === 'decisions' && next.status !== InboxItemStatusEnum.OPEN) {
			this.items.set(this.items().filter((entry) => entry.id !== next.id));
		} else {
			this.items.set(replaceItem(this.items(), next));
		}
	}

	private setReplying(id: string, on: boolean): void {
		const next = new Set(this.replying());
		if (on) next.add(id);
		else next.delete(id);
		this.replying.set(next);
	}

	private setReplyError(id: string, message: string | null): void {
		this.replyErrors.set({ ...this.replyErrors(), [id]: message });
	}

	changeState(item: IInboxItemWithState, change: IInboxRecipientStateInput): void {
		if (!item.id) return;
		this.busy.set(true);
		this.actionError.set(null);
		this.api.setState(item.id, change).subscribe({
			next: (next) => {
				this.busy.set(false);
				if (this.opened()?.id === next.id) this.opened.set(next);
				if (this.leavesList(change, next)) {
					this.items.set(this.items().filter((entry) => entry.id !== next.id));
					// Archived, snoozed, woken, done or brought back: it is gone from this view. Only read: it stays open.
					const onlyRead =
						change.isRead !== undefined &&
						change.isArchived === undefined &&
						change.snoozedUntil === undefined &&
						change.isDone === undefined;
					if (this.selectedId() === next.id && !onlyRead) this.selectedId.set(null);
					// The API pages by offset: with an item gone, the next page would skip one. Start over.
					if (this.nextCursor()) this.reload();
				} else {
					this.items.set(replaceItem(this.items(), next));
				}
				this.api.notifyChanged();
			},
			error: (error: HttpErrorResponse) => {
				this.busy.set(false);
				this.actionError.set(apiMessage(error) ?? 'INBOX.ACTION_FAILED');
			}
		});
	}

	/**
	 * Whether an item no longer belongs to the list shown after a change of my state: the tab's own rule over the
	 * state the API answered (`listedIn`, the API's rules — an archived item marked done stays in Archived, a done
	 * item snoozed stays in Done), then the "unread only" filter.
	 */
	private leavesList(_change: IInboxRecipientStateInput, next: IInboxItemWithState): boolean {
		if (!listedIn(this.tab(), next)) return true;
		return this.unreadOnly() && !isUnread(next);
	}

	markAllRead(): void {
		const tab = apiTabOf(this.tab());
		if (!tab) return;
		this.actionError.set(null);
		// Only what the list shows: its kind, source and text filters go along (review F65).
		const scope = this.listScope;
		this.api.markAllRead(tab, { kind: this.kind(), source: this.source(), q: this.query() }).subscribe({
			next: () => {
				// The list may have changed (another tab or filter) while it was on its way: then it says nothing.
				if (scope === this.listScope) this.markedAll.set(true);
				this.api.notifyChanged();
				this.reload();
			},
			error: (error: HttpErrorResponse) => this.actionError.set(apiMessage(error) ?? 'INBOX.ACTION_FAILED')
		});
	}

	/** The tab or a filter changed: a mark-all of before no longer covers the list. */
	private listChanged(): void {
		this.listScope++;
		this.markedAll.set(false);
	}

	private refresh(id: string): void {
		this.api.get(id).subscribe({
			// "Already decided" elsewhere (409): the decided item leaves the Decisions tab too (#11098 review).
			next: (next) => this.useAnswered(next)
		});
	}
}
