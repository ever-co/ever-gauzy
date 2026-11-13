import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	Injector,
	OnInit,
	signal
} from '@angular/core';
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
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, forkJoin, interval, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, skip, switchMap } from 'rxjs/operators';
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
	dueStateOf,
	emailHeaderOf,
	groupByDate,
	InboxDueState,
	InboxUndoKind,
	INBOX_SHORTCUTS,
	isArchived,
	isDone,
	isTypingTarget,
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
	sourceLabelOf,
	undoOf
} from '../../inbox-ui.helpers';
import { InboxEmailAvailabilityService } from '../../services/inbox-email-availability.service';
import { InboxUiService } from '../../services/inbox-ui.service';
import { InboxItemDetailComponent } from '../inbox-item-detail/inbox-item-detail.component';
import { InboxNotificationsComponent } from '../inbox-notifications/inbox-notifications.component';

/** What the page shows. */
export type InboxPageView = 'loading' | 'ready' | 'unavailable' | 'error';

/** How often the page looks for new items while it is open and visible. */
export const INBOX_POLL_MS = 60_000;
/** How long the "Undo" toast stays. */
export const INBOX_UNDO_MS = 6_000;
/** The list pane's width bounds when dragged (px), and where the chosen width is kept in this browser. */
const LIST_WIDTH_MIN = 256;
const LIST_WIDTH_MAX = 640;
const LIST_WIDTH_KEY = 'gauzy.inbox.listWidth';

/** The last change that moved items away, for its "Undo": what it did and, by item, the change that takes it back. */
interface InboxUndo {
	kind: InboxUndoKind;
	entries: Array<{ id: string; revert: IInboxRecipientStateInput }>;
}

/** The list pane's width this browser keeps (`null`: none, or storage is not available). */
function storedListWidth(): number | null {
	try {
		const value = Number(globalThis.localStorage?.getItem(LIST_WIDTH_KEY));
		return Number.isFinite(value) && value >= LIST_WIDTH_MIN && value <= LIST_WIDTH_MAX ? value : null;
	} catch {
		return null;
	}
}

function storeListWidth(width: number | null): void {
	try {
		if (width === null) globalThis.localStorage?.removeItem(LIST_WIDTH_KEY);
		else globalThis.localStorage?.setItem(LIST_WIDTH_KEY, String(Math.round(width)));
	} catch {
		// Private windows and blocked storage: the width is kept for this visit only.
	}
}

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
	// The list's keyboard shortcuts (see onKeydown).
	host: {
		'(document:keydown)': 'onKeydown($event)'
	},
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
		NbTooltipModule,
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
					@if (view() === 'ready') {
						<button
							nbButton
							ghost
							size="small"
							data-test="shortcuts"
							[nbTooltip]="'INBOX.SHORTCUTS.OPEN' | translate"
							nbTooltipPlacement="top"
							[attr.aria-label]="'INBOX.SHORTCUTS.OPEN' | translate"
							(click)="openShortcuts()"
						>
							<nb-icon icon="keypad-outline"></nb-icon>
						</button>
					}
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
							<div
								class="panes"
								[class.has-selection]="!!selected()"
								[style.--list-width]="listWidth() ? listWidth() + 'px' : null"
							>
								<section class="list-pane">
									<!-- Drag (or arrow keys) to resize the list; a double click goes back to its own width. -->
									<div
										class="resizer"
										role="separator"
										tabindex="0"
										aria-orientation="vertical"
										data-test="resizer"
										[attr.aria-label]="'INBOX.RESIZE' | translate"
										(pointerdown)="startResize($event)"
										(pointermove)="resize($event)"
										(pointerup)="endResize($event)"
										(pointercancel)="endResize($event)"
										(dblclick)="resetWidth()"
										(keydown.arrowleft)="nudgeWidth(-16, $event)"
										(keydown.arrowright)="nudgeWidth(16, $event)"
									></div>
									@if (checkedCount()) {
										<!-- With rows selected, their actions take the filters' place (as mail apps do). -->
										<div class="bulk-bar" data-test="bulk-bar">
											<button
												type="button"
												class="check"
												role="checkbox"
												data-test="check-all"
												[class.on]="allChecked()"
												[attr.aria-checked]="allChecked() ? 'true' : 'mixed'"
												[nbTooltip]="'INBOX.BULK.SELECT_ALL' | translate"
												nbTooltipPlacement="top"
												[attr.aria-label]="'INBOX.BULK.SELECT_ALL' | translate"
												(click)="toggleAll()"
											>
												<nb-icon [icon]="allChecked() ? 'checkmark-outline' : 'minus-outline'"></nb-icon>
											</button>
											<span class="bulk-count" data-test="bulk-count">{{
												'INBOX.BULK.SELECTED' | translate: { count: checkedCount() }
											}}</span>
											<div class="bulk-actions">
												<button
													type="button"
													class="bulk-tool"
													data-test="bulk-read"
													[disabled]="busy()"
													[nbTooltip]="'INBOX.ACTIONS.MARK_READ' | translate"
													nbTooltipPlacement="top"
													[attr.aria-label]="'INBOX.ACTIONS.MARK_READ' | translate"
													(click)="bulk({ isRead: true })"
												>
													<nb-icon icon="done-all-outline"></nb-icon>
												</button>
												<button
													type="button"
													class="bulk-tool"
													data-test="bulk-unread"
													[disabled]="busy()"
													[nbTooltip]="'INBOX.ACTIONS.MARK_UNREAD' | translate"
													nbTooltipPlacement="top"
													[attr.aria-label]="'INBOX.ACTIONS.MARK_UNREAD' | translate"
													(click)="bulk({ isRead: false })"
												>
													<nb-icon icon="email-outline"></nb-icon>
												</button>
												<button
													type="button"
													class="bulk-tool"
													data-test="bulk-archive"
													[disabled]="busy()"
													[nbTooltip]="(tab() === 'archived' ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate"
													nbTooltipPlacement="top"
													[attr.aria-label]="(tab() === 'archived' ? 'INBOX.ACTIONS.UNARCHIVE' : 'INBOX.ACTIONS.ARCHIVE') | translate"
													(click)="bulk({ isArchived: tab() !== 'archived' })"
												>
													<nb-icon [icon]="tab() === 'archived' ? 'arrow-circle-up-outline' : 'archive-outline'"></nb-icon>
												</button>
												<button
													type="button"
													class="bulk-tool"
													data-test="bulk-done"
													[disabled]="busy()"
													[nbTooltip]="(tab() === 'done' ? 'INBOX.ACTIONS.MARK_NOT_DONE' : 'INBOX.ACTIONS.MARK_DONE') | translate"
													nbTooltipPlacement="top"
													[attr.aria-label]="(tab() === 'done' ? 'INBOX.ACTIONS.MARK_NOT_DONE' : 'INBOX.ACTIONS.MARK_DONE') | translate"
													(click)="bulk({ isDone: tab() !== 'done' })"
												>
													<nb-icon [icon]="tab() === 'done' ? 'undo-outline' : 'checkmark-circle-2-outline'"></nb-icon>
												</button>
												<span class="bulk-divider" aria-hidden="true"></span>
												<button
													type="button"
													class="bulk-tool"
													data-test="bulk-clear"
													[nbTooltip]="'INBOX.BULK.CLEAR' | translate"
													nbTooltipPlacement="top"
													[attr.aria-label]="'INBOX.BULK.CLEAR' | translate"
													(click)="clearChecked()"
												>
													<nb-icon icon="close-outline"></nb-icon>
												</button>
											</div>
										</div>
									} @else {
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
									}

									<div
										class="list"
										data-test="list"
										[class.selecting]="checkedCount() > 0"
										[nbSpinner]="loading() && items().length > 0"
										nbSpinnerSize="small"
									>
										@if (newCount(); as count) {
											<button type="button" class="new-pill" data-test="new-items" (click)="showNew()">
												<nb-icon icon="arrow-upward-outline"></nb-icon>
												{{ 'INBOX.NEW_ITEMS' | translate: { count: count } }} · {{ 'INBOX.SHOW_NEW' | translate }}
											</button>
										}
										@if (loading() && !items().length) {
											<!-- Placeholder rows while the first page is read. -->
											<div class="skeleton" data-test="skeleton" aria-hidden="true">
												@for (row of skeletonRows; track row) {
													<div class="skeleton-row">
														<span class="skeleton-avatar"></span>
														<span class="skeleton-lines">
															<span class="skeleton-line" [style.width.%]="62 + ((row * 7) % 30)"></span>
															<span class="skeleton-line short" [style.width.%]="40 + ((row * 11) % 35)"></span>
														</span>
													</div>
												}
											</div>
										}
										@for (section of sections(); track section.group) {
											<div class="group-label" aria-hidden="true" [attr.data-test]="'group-' + section.group">
												{{ 'INBOX.GROUP.' + section.group | translate }}
											</div>
											<!-- Each day a list; each row an item whose title is the button that opens it. -->
											<div class="rows" role="list" [attr.aria-label]="'INBOX.GROUP.' + section.group | translate">
											@for (item of section.items; track item.id) {
												@let due = dueState(item);
												<div
													class="row"
													role="listitem"
													[class.selected]="item.id === selectedId()"
													[class.unread]="unread(item)"
													[class.checked]="isChecked(item)"
													[attr.data-test]="'item-' + item.id"
												>
													<span class="unread-dot" aria-hidden="true"></span>
													<span class="lead">
														<span class="avatar" [attr.data-kind]="item.kind" aria-hidden="true">
															<nb-icon [icon]="kindIcon(item.kind)"></nb-icon>
														</span>
														<button
															type="button"
															class="check"
															role="checkbox"
															[class.on]="isChecked(item)"
															[attr.aria-checked]="isChecked(item)"
															[attr.aria-label]="'INBOX.BULK.SELECT' | translate"
															[nbTooltip]="'INBOX.BULK.SELECT' | translate"
															nbTooltipPlacement="top"
															[attr.data-test]="'check-' + item.id"
															(click)="toggleChecked(item, $event)"
															(keydown.enter)="$event.stopPropagation()"
														>
															@if (isChecked(item)) {
																<nb-icon icon="checkmark-outline"></nb-icon>
															}
														</button>
													</span>
													<div class="row-main">
														<div class="row-top">
															<!-- The row's open action: a native button (Enter and Space), stretched over the row. -->
															<button
																type="button"
																class="row-open"
																[attr.aria-current]="item.id === selectedId() ? 'true' : null"
																[attr.data-test]="'open-' + item.id"
																(click)="open(item)"
															>
																<span class="row-title">{{ item.title }}</span>
															</button>
															<!--
																The time and the due label sit above the title button's row-wide layer (for their
																tooltips), so a click on them opens the row itself; the keyboard opens it by the button.
															-->
															<time
																class="when"
																[attr.datetime]="item.createdAt"
																[attr.data-test]="'when-' + item.id"
																[nbTooltip]="item.createdAt | date: 'medium'"
																nbTooltipPlacement="top"
																(click)="open(item)"
																>{{ item.createdAt | date: listDate(item.createdAt) }}</time
															>
														</div>
														@if (preview(item); as text) {
															<div class="row-preview">{{ text }}</div>
														}
														<div class="row-meta">
															<span class="tag">{{ 'INBOX.KIND.' + item.kind | translate }}</span>
															<!-- An email names its sender; anything else its source ("Email · Email" said nothing). -->
															@if (senderName(item); as sender) {
																<span class="source" data-test="row-sender">{{ sender }}</span>
															} @else if (item.source !== item.kind) {
																<span class="source">{{
																	isKey(sourceLabel(item.source))
																		? (sourceLabel(item.source) | translate)
																		: item.source
																}}</span>
															}
															@if (item.priority === 'high' || item.priority === 'urgent') {
																<span class="tag priority" [attr.data-priority]="item.priority">
																	<nb-icon icon="arrow-upward-outline"></nb-icon>
																	{{ 'INBOX.PRIORITY.' + item.priority | translate }}
																</span>
															}
															@if (due) {
																<span
																	class="tag due"
																	[attr.data-due]="due"
																	[attr.data-test]="'due-' + item.id"
																	[nbTooltip]="item.dueAt | date: 'medium'"
																	nbTooltipPlacement="top"
																	(click)="open(item)"
																>
																	<nb-icon icon="calendar-outline"></nb-icon>
																	{{
																		'INBOX.DUE_STATE.' + due
																			| translate: { date: (item.dueAt | date: 'MMM d') }
																	}}
																</span>
															}
														</div>
													</div>
												</div>
											}
											</div>
										} @empty {
											@if (!loading()) {
												<div class="state compact" data-test="empty">
													@if (filtered()) {
														<span class="state-icon"><nb-icon icon="search-outline"></nb-icon></span>
														<strong>{{ 'INBOX.EMPTY_FILTERED.TITLE' | translate }}</strong>
														<span class="state-hint">{{ 'INBOX.EMPTY_FILTERED.HINT' | translate }}</span>
														<button
															nbButton
															size="tiny"
															status="basic"
															data-test="clear-filters"
															(click)="clearFilters()"
														>
															{{ 'INBOX.FILTERS.CLEAR' | translate }}
														</button>
													} @else {
														<span class="state-icon"><nb-icon [icon]="tabIcons[tab()]"></nb-icon></span>
														<strong>{{ 'INBOX.EMPTY_TAB.' + tab() + '.TITLE' | translate }}</strong>
														<span class="state-hint">{{
															'INBOX.EMPTY_TAB.' + tab() + '.HINT' | translate
														}}</span>
													}
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
											<!-- The message icon drawn here, so its parts move: the bubble pops in, its lines are written. -->
											<span class="state-icon waiting" aria-hidden="true">
												<svg
													class="writing"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="1.6"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path
														class="bubble"
														d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"
													/>
													<path class="line line-1" pathLength="1" d="M8 9h8" />
													<path class="line line-2" pathLength="1" d="M8 13h5" />
												</svg>
											</span>
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

		@if (undo(); as toast) {
			<!-- "Archived · Undo", as mail apps confirm an action that moved items away. -->
			<div class="toast" role="status" data-test="undo-toast">
				<span>{{ 'INBOX.UNDO.' + toast.kind | translate: { count: toast.entries.length } }}</span>
				<button type="button" class="toast-action" data-test="undo" (click)="undoLast()">
					{{ 'INBOX.UNDO.ACTION' | translate }}
				</button>
				<button
					type="button"
					class="toast-close"
					[attr.aria-label]="'INBOX.SHORTCUTS.CLOSE_SHEET' | translate"
					(click)="dismissUndo()"
				>
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</div>
		}

		@if (shortcutsOpen()) {
			<div class="sheet-backdrop" (click)="closeShortcuts()">
				<div
					class="sheet"
					role="dialog"
					aria-modal="true"
					aria-labelledby="inbox-shortcuts-title"
					data-test="shortcuts-sheet"
					tabindex="-1"
					(click)="$event.stopPropagation()"
					(keydown.tab)="keepFocusIn($event)"
					(keydown.shift.tab)="keepFocusIn($event)"
				>
					<div class="sheet-header">
						<h5 id="inbox-shortcuts-title">{{ 'INBOX.SHORTCUTS.TITLE' | translate }}</h5>
						<button
							type="button"
							class="toast-close sheet-close"
							data-test="shortcuts-close"
							[attr.aria-label]="'INBOX.SHORTCUTS.CLOSE_SHEET' | translate"
							(click)="closeShortcuts()"
						>
							<nb-icon icon="close-outline"></nb-icon>
						</button>
					</div>
					<dl class="shortcut-list">
						@for (shortcut of shortcuts; track shortcut.action) {
							<div class="shortcut">
								<dt>{{ 'INBOX.SHORTCUTS.' + shortcut.action | translate }}</dt>
								<dd>
									@for (key of shortcut.keys; track key) {
										<kbd>{{ key }}</kbd>
									}
								</dd>
							</div>
						}
					</dl>
				</div>
			</div>
		}
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
				/* The list's width: 22rem, or the width it was dragged to (never under 16rem nor over half the page). */
				grid-template-columns: clamp(16rem, var(--list-width, 22rem), 50%) minmax(0, 1fr);
				height: clamp(30rem, calc(100vh - 17rem), 64rem);
			}
			.list-pane {
				position: relative;
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
			/*
			 * The filter selects at the task page's control size (1.75rem), by Nebular's own tokens rather than by
			 * reaching into nb-select: every one is nb-theme(...), i.e. a CSS custom property, so redefining it on
			 * the element is the whole change (the pattern the Employees and Projects pages use for nb-toggle).
			 *
			 * --select-medium-text-line-height is set too, though these selects are small: the app's control floor
			 * ($default-height in _gauzy-overrides.scss, applied to every nb-select with !important) is
			 * calc(var(--select-medium-text-line-height) + 0.4375rem * 2). 0.875rem puts that floor at 1.75rem.
			 */
			.filter-row nb-select {
				flex: 1 1 0;
				min-width: 0;
				max-width: none;
				--select-min-width: 0;
				--select-small-max-width: none;
				--select-medium-text-line-height: 0.875rem;
				--select-small-text-line-height: 1rem;
				--select-outline-small-padding: 0.3125rem 0.5rem;
				--select-icon-offset: 1.5rem;
				--select-small-text-font-size: 0.75rem;
				--select-small-text-font-weight: 500;
				--select-small-placeholder-text-font-size: 0.75rem;
				--select-small-placeholder-text-font-weight: 500;
			}
			/* The "Unread only" checkbox, smaller, by nb-checkbox's tokens. */
			.unread-toggle {
				flex: 0 0 auto;
				white-space: nowrap;
				--checkbox-height: 1rem;
				--checkbox-width: 1rem;
				--checkbox-text-space: 0.375rem;
				--checkbox-text-font-size: 0.75rem;
				--checkbox-text-font-weight: 500;
				--checkbox-text-line-height: 1rem;
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
				/* Its own stacking context: the layers inside it never rise over the sticky day labels. */
				isolation: isolate;
				transition: background-color 0.12s ease;
			}
			.row + .row {
				margin-top: 1px;
			}
			.row:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.08));
			}
			/*
			 * The open action: the title is a native button whose ::after covers the whole row, so a click anywhere on
			 * the row opens it and the keyboard focus ring is drawn around the row. The checkbox, the time and the due
			 * label sit above it (their own click, their own tooltip).
			 */
			.row-open {
				position: static;
				display: block;
				flex: 1;
				min-width: 0;
				padding: 0;
				border: 0;
				background: none;
				color: inherit;
				font: inherit;
				text-align: left;
				cursor: pointer;
			}
			.row-open::after {
				content: '';
				position: absolute;
				inset: 0;
				z-index: 1;
				border-radius: inherit;
			}
			.row-open:focus {
				outline: none;
			}
			.row-open:focus-visible::after {
				box-shadow: inset 0 0 0 2px var(--color-primary-500, #6e49e8);
			}
			.row-open .row-title {
				display: block;
			}
			.row .when,
			.row .tag.due {
				position: relative;
				z-index: 2;
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
			.tag {
				display: inline-flex;
				align-items: center;
				gap: 0.1875rem;
			}
			.tag nb-icon {
				width: 0.6875rem;
				height: 0.6875rem;
				font-size: 0.6875rem;
			}
			.tag.priority[data-priority='high'] {
				background: var(--color-warning-transparent-200, rgba(255, 170, 0, 0.16));
				color: var(--color-warning-600, #db8b00);
			}
			.tag.due {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.tag.due[data-due='TODAY'] {
				background: var(--color-warning-transparent-200, rgba(255, 170, 0, 0.16));
				color: var(--color-warning-600, #db8b00);
			}
			.tag.due[data-due='OVERDUE'] {
				background: var(--color-danger-transparent-200, rgba(255, 61, 113, 0.16));
				color: var(--color-danger-500, #ff3d71);
			}
			.load-more {
				display: flex;
				justify-content: center;
				padding: 0.375rem;
			}

			/* Day sections: a small label that stays on top while its rows scroll by. */
			.group-label {
				position: sticky;
				top: -0.25rem;
				z-index: 1;
				margin: 0 -0.25rem;
				padding: 0.5rem 0.875rem 0.25rem;
				background: var(--background-basic-color-1, #fff);
				font-size: 0.6875rem;
				font-weight: 600;
				line-height: 1rem;
				letter-spacing: 0.02em;
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.rows + .group-label {
				margin-top: 0.25rem;
			}

			/* "3 new · Show": newer items arrived since the list was read. */
			.new-pill {
				position: sticky;
				top: 0.25rem;
				z-index: 2;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				margin: 0.25rem auto;
				padding: 0.25rem 0.75rem;
				border: 0;
				border-radius: 999px;
				background: var(--color-primary-500, #6e49e8);
				color: var(--text-control-color, #fff);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				line-height: 1rem;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
				cursor: pointer;
			}
			.new-pill nb-icon {
				width: 0.75rem;
				height: 0.75rem;
				font-size: 0.75rem;
			}

			/* Placeholder rows while the first page is read */
			.skeleton-row {
				display: flex;
				gap: 0.625rem;
				align-items: flex-start;
				padding: 0.625rem 0.625rem 0.625rem 0.875rem;
			}
			.skeleton-avatar,
			.skeleton-line {
				background: linear-gradient(
					90deg,
					var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12)) 25%,
					var(--background-basic-color-2, rgba(126, 126, 143, 0.04)) 50%,
					var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12)) 75%
				);
				background-size: 200% 100%;
				animation: shimmer 1.4s ease-in-out infinite;
			}
			.skeleton-avatar {
				flex-shrink: 0;
				width: 1.75rem;
				height: 1.75rem;
				border-radius: 50%;
			}
			.skeleton-lines {
				flex: 1;
				display: flex;
				flex-direction: column;
				gap: 0.375rem;
				padding-top: 0.125rem;
			}
			.skeleton-line {
				height: 0.625rem;
				border-radius: 0.25rem;
			}
			.skeleton-line.short {
				height: 0.5rem;
			}
			@keyframes shimmer {
				from {
					background-position: 200% 0;
				}
				to {
					background-position: -200% 0;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.skeleton-avatar,
				.skeleton-line {
					animation: none;
				}
			}

			/* A row's checkbox takes the avatar's place under the pointer, once checked, or while rows are selected. */
			.lead {
				position: relative;
				flex-shrink: 0;
				width: 1.75rem;
				height: 1.75rem;
			}
			.lead .check {
				position: absolute;
				z-index: 2;
				inset: 0.375rem;
				display: none;
			}
			.row:hover .lead .avatar,
			.row:focus-within .lead .avatar,
			.row.checked .lead .avatar,
			.list.selecting .lead .avatar {
				display: none;
			}
			.row:hover .lead .check,
			.row:focus-within .lead .check,
			.row.checked .lead .check,
			.list.selecting .lead .check {
				display: inline-flex;
			}
			.check {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				width: 1rem;
				height: 1rem;
				padding: 0;
				border: 1.5px solid var(--gauzy-text-color-2, #8f9bb3);
				border-radius: 0.25rem;
				background: var(--background-basic-color-1, #fff);
				color: var(--text-control-color, #fff);
				cursor: pointer;
			}
			.check nb-icon {
				width: 0.625rem;
				height: 0.625rem;
				font-size: 0.625rem;
			}
			.check.on,
			.check[aria-checked='mixed'] {
				border-color: var(--color-primary-500, #6e49e8);
				background: var(--color-primary-500, #6e49e8);
			}
			.check:focus-visible {
				outline: 2px solid var(--gauzy-action-info-text, #0095ff);
				outline-offset: 1px;
			}
			.row.checked {
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.08));
			}

			/* The selection's actions, where the filters were */
			.bulk-bar {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				/* The filters' height (search, gap, selects, padding, border), so the list does not jump. */
				min-height: calc(5.375rem + 1px);
				padding: 0.625rem 0.75rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				background: var(--color-primary-transparent-100, rgba(110, 73, 232, 0.06));
			}
			.bulk-count {
				flex: 1;
				min-width: 0;
				font-size: 0.75rem;
				font-weight: 600;
				color: var(--gauzy-text-color-1, #222b45);
				white-space: nowrap;
			}
			.bulk-actions {
				display: flex;
				align-items: center;
				gap: 0.125rem;
			}
			.bulk-tool {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: var(--gauzy-text-color-2, #8f9bb3);
				cursor: pointer;
				transition:
					background-color 0.12s ease,
					color 0.12s ease;
			}
			.bulk-tool nb-icon {
				width: 1rem;
				height: 1rem;
				font-size: 1rem;
			}
			.bulk-tool:hover:not(:disabled) {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				color: var(--gauzy-text-color-1, #222b45);
			}
			.bulk-tool:disabled {
				opacity: 0.45;
				cursor: default;
			}
			.bulk-tool:focus-visible {
				outline: 2px solid var(--gauzy-action-info-text, #0095ff);
				outline-offset: 1px;
			}
			.bulk-divider {
				width: 1px;
				height: 1rem;
				margin: 0 0.25rem;
				background: var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
			}

			/* The list's right edge, dragged to resize it */
			.resizer {
				position: absolute;
				top: 0;
				right: -4px;
				bottom: 0;
				z-index: 3;
				width: 7px;
				cursor: col-resize;
				touch-action: none;
			}
			.resizer::after {
				content: '';
				position: absolute;
				top: 0;
				bottom: 0;
				left: 3px;
				width: 1px;
				background: transparent;
				transition: background-color 0.12s ease;
			}
			.resizer:hover::after,
			.resizer:focus-visible::after,
			.resizer.dragging::after {
				width: 2px;
				background: var(--color-primary-500, #6e49e8);
			}
			.resizer:focus-visible {
				outline: none;
			}


			/* Kind avatars: one neutral tone for every kind (the icon tells the kind); an unread row's is darker. */
			.row.unread .avatar {
				--tone: var(--gauzy-text-color-1, #222b45);
			}
			.avatar {
				--tone: var(--gauzy-text-color-2, #8f9bb3);
				--tone-bg: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
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
			/*
			 * "Select an item": the icon's own parts move, on one 4s loop. The bubble pops in from its tail, the first
			 * line is written, then the second; both stay a moment, fade, and the bubble breathes before the next one.
			 */
			.state-icon.waiting {
				width: 4.25rem;
				height: 4.25rem;
			}
			.writing {
				width: 2rem;
				height: 2rem;
				overflow: visible;
			}
			.writing .bubble {
				transform-box: fill-box;
				transform-origin: 20% 100%;
				animation: bubble-pop 4s ease-in-out infinite;
			}
			.writing .line {
				stroke-dasharray: 1;
				stroke-dashoffset: 1;
			}
			.writing .line-1 {
				animation: write-line-1 4s ease-in-out infinite;
			}
			.writing .line-2 {
				animation: write-line-2 4s ease-in-out infinite;
			}
			@keyframes bubble-pop {
				0% {
					transform: scale(0.86);
				}
				10% {
					transform: scale(1.04);
				}
				16%,
				84% {
					transform: scale(1);
				}
				92% {
					transform: scale(0.96);
				}
				100% {
					transform: scale(0.86);
				}
			}
			@keyframes write-line-1 {
				0%,
				14% {
					stroke-dashoffset: 1;
					opacity: 1;
				}
				32%,
				76% {
					stroke-dashoffset: 0;
					opacity: 1;
				}
				88%,
				100% {
					stroke-dashoffset: 0;
					opacity: 0;
				}
			}
			@keyframes write-line-2 {
				0%,
				34% {
					stroke-dashoffset: 1;
					opacity: 1;
				}
				48%,
				76% {
					stroke-dashoffset: 0;
					opacity: 1;
				}
				88%,
				100% {
					stroke-dashoffset: 0;
					opacity: 0;
				}
			}
			/* Reduced motion: the icon as it is, still and whole. */
			@media (prefers-reduced-motion: reduce) {
				.writing .bubble,
				.writing .line {
					animation: none;
				}
				.writing .line {
					stroke-dashoffset: 0;
				}
			}
			.state-hint {
				max-width: 22rem;
				font-size: 0.8125rem;
				color: var(--text-hint-color, #8f9bb3);
			}
			.loading {
				min-height: 16rem;
			}

			/* "2 archived · Undo", at the bottom of the screen */
			.toast {
				position: fixed;
				left: 50%;
				bottom: 1.5rem;
				z-index: 1040;
				display: flex;
				align-items: center;
				gap: 0.75rem;
				max-width: calc(100vw - 2rem);
				padding: 0.5rem 0.5rem 0.5rem 1rem;
				border-radius: 0.5rem;
				background: var(--tooltip-background-color, #222b45);
				color: var(--tooltip-text-color, #fff);
				font-size: 0.8125rem;
				line-height: 1.25rem;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
				transform: translateX(-50%);
				animation: toast-in 0.16s ease-out;
			}
			@keyframes toast-in {
				from {
					opacity: 0;
					transform: translate(-50%, 0.5rem);
				}
			}
			.toast-action {
				padding: 0.25rem 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: inherit;
				text-decoration: underline;
				text-underline-offset: 0.1875rem;
				font: inherit;
				font-weight: 600;
				cursor: pointer;
			}
			.toast-action:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.16));
			}
			.toast-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 0;
				border-radius: 0.375rem;
				background: none;
				color: inherit;
				opacity: 0.7;
				cursor: pointer;
			}
			.toast-close:hover {
				opacity: 1;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.16));
			}
			.toast-close nb-icon {
				width: 1rem;
				height: 1rem;
				font-size: 1rem;
			}
			.toast-action:focus-visible,
			.toast-close:focus-visible {
				outline: 2px solid var(--tooltip-text-color, #fff);
				outline-offset: 1px;
			}

			/* The "?" sheet of keyboard shortcuts */
			.sheet-backdrop {
				position: fixed;
				inset: 0;
				z-index: 1050;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 1rem;
				background: rgba(0, 0, 0, 0.32);
			}
			.sheet {
				width: 100%;
				max-width: 24rem;
				max-height: calc(100vh - 2rem);
				overflow-y: auto;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
				border-radius: 0.75rem;
				background: var(--background-basic-color-1, #fff);
				box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24);
			}
			.sheet-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0.75rem 0.75rem 0.5rem 1rem;
				border-bottom: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.18));
			}
			.sheet-header h5 {
				margin: 0;
				font-size: 0.9375rem;
				font-weight: 600;
			}
			.sheet-close {
				color: var(--gauzy-text-color-2, #8f9bb3);
			}
			.sheet-close:hover {
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
			}
			.shortcut-list {
				margin: 0;
				padding: 0.375rem 0;
			}
			.shortcut {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 1rem;
				padding: 0.375rem 1rem;
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			.shortcut dt {
				font-weight: 400;
				color: var(--gauzy-text-color-1, #222b45);
			}
			.shortcut dd {
				display: flex;
				gap: 0.25rem;
				margin: 0;
			}
			kbd {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.5rem;
				height: 1.5rem;
				padding: 0 0.375rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(126, 126, 143, 0.32));
				border-bottom-width: 2px;
				border-radius: 0.3125rem;
				background: var(--background-basic-color-2, #f7f9fc);
				color: var(--gauzy-text-color-1, #222b45);
				font-family: inherit;
				font-size: 0.75rem;
				font-weight: 600;
				box-shadow: none;
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
				.resizer {
					display: none;
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

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly injector = inject(Injector);
	protected readonly shortcuts = INBOX_SHORTCUTS;
	protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
	/** The rows in their day sections (Today, Yesterday, …). */
	readonly sections = computed(() => groupByDate(this.items()));
	/** A search or a filter narrows the list (its empty state then offers to clear them). */
	readonly filtered = computed(() => !!(this.query().trim() || this.kind() || this.source() || this.unreadOnly()));

	/** The rows checked for a bulk action, by id. */
	readonly checked = signal<ReadonlySet<string>>(new Set());
	readonly checkedCount = computed(() => this.checked().size);
	readonly allChecked = computed(() => {
		const items = this.items();
		const checked = this.checked();
		return items.length > 0 && items.every((item) => !!item.id && checked.has(item.id));
	});

	/** Items newer than the list, found by the page's periodic look (the list itself is not changed under the reader). */
	readonly newCount = signal(0);
	/** The "?" sheet of keyboard shortcuts is open. */
	readonly shortcutsOpen = signal(false);
	/** The last change that moved items away, while its "Undo" is offered. */
	readonly undo = signal<InboxUndo | null>(null);
	private undoTimer: ReturnType<typeof setTimeout> | null = null;

	/** The list pane's width (px) as dragged; `null`: its own width. */
	readonly listWidth = signal<number | null>(storedListWidth());
	private resizeStart: { x: number; width: number } | null = null;

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
		this.lookForNewItems();
		this.checkAvailability();
		this.destroyRef.onDestroy(() => this.clearUndoTimer());
	}

	/**
	 * Every minute, while the page is visible and the list idle: the first page as the list asks for it, compared with
	 * the list. Items it has that the list does not are announced ("3 new · Show") rather than slipped in under the
	 * reader. The tabs' counts are read again at the same time.
	 */
	private lookForNewItems(): void {
		interval(INBOX_POLL_MS)
			.pipe(
				filter(
					() =>
						this.view() === 'ready' &&
						!this.loading() &&
						typeof document !== 'undefined' &&
						document.visibilityState === 'visible'
				),
				switchMap(() => {
					const tab = apiTabOf(this.tab());
					this.api
						.counts()
						.pipe(catchError(() => EMPTY))
						.subscribe((counts) => this.counts.set(counts));
					if (!tab) return EMPTY;
					const scope = this.listScope;
					return this.api.list({ ...this.listQuery(tab), limit: INBOX_UI_PAGE_SIZE }).pipe(
						map((page) => ({ page, scope })),
						catchError(() => EMPTY)
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ page, scope }) => {
				// The list changed (another tab or filter, a reload) while it was read: it says nothing about this list.
				if (scope !== this.listScope || this.loading()) return;
				const listed = new Set(this.items().map((item) => item.id));
				this.newCount.set((page?.items ?? []).filter((item) => item.id && !listed.has(item.id)).length);
			});
	}

	/** The list's filters as the API takes them. */
	private listQuery(tab: NonNullable<ReturnType<typeof apiTabOf>>) {
		return {
			tab,
			kind: this.kind() ?? undefined,
			source: this.source() ?? undefined,
			unread: this.unreadOnly() || undefined,
			q: this.query().trim() || undefined
		};
	}

	/** "3 new · Show": the list read again from its first page. */
	showNew(): void {
		this.newCount.set(0);
		this.reload();
		this.host.nativeElement.querySelector('.list')?.scrollTo?.({ top: 0 });
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
							...this.listQuery(apiTab),
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
				if (!append) {
					// A fresh first page: nothing newer to announce, and only rows still listed stay checked.
					this.newCount.set(0);
					this.pruneChecked();
				}
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
		// What the change takes back, as the item was before it (archive, done, snooze: an "Undo" is offered).
		const undo = undoOf(change, item);
		this.api.setState(item.id, change).subscribe({
			next: (next) => {
				this.busy.set(false);
				if (this.opened()?.id === next.id) this.opened.set(next);
				if (undo && next.id) this.offerUndo({ kind: undo.kind, entries: [{ id: next.id, revert: undo.revert }] });
				if (this.leavesList(change, next)) {
					this.items.set(this.items().filter((entry) => entry.id !== next.id));
					// Archived, snoozed, woken, done or brought back: it is gone from this view. Only read: it stays open.
					if (this.selectedId() === next.id && !this.onlyRead(change)) this.selectedId.set(null);
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
		this.newCount.set(0);
		this.clearChecked();
	}

	/** Every filter off and the search emptied: the whole tab again. */
	clearFilters(): void {
		this.listChanged();
		this.kind.set(null);
		this.source.set(null);
		this.unreadOnly.set(false);
		this.query.set('');
		this.reload();
	}

	/** An email row's sender (`null` for any other item, or an email that does not say who sent it). */
	senderName(item: IInboxItemWithState): string | null {
		return item.kind === InboxItemKindEnum.EMAIL ? emailHeaderOf(item).fromName : null;
	}

	/** A row's due label: overdue, due today, or due later (`null`: none to show). */
	dueState(item: IInboxItemWithState): InboxDueState | null {
		return dueStateOf(item);
	}

	// --- Bulk selection -------------------------------------------------------------------------------------------

	isChecked(item: IInboxItemWithState): boolean {
		return !!item.id && this.checked().has(item.id);
	}

	/** A row's checkbox: the row is not opened by it. */
	toggleChecked(item: IInboxItemWithState, event?: Event): void {
		event?.stopPropagation();
		if (!item.id) return;
		const next = new Set(this.checked());
		if (next.has(item.id)) next.delete(item.id);
		else next.add(item.id);
		this.checked.set(next);
	}

	/** Every listed row checked, or none when they all are. */
	toggleAll(): void {
		this.checked.set(
			this.allChecked()
				? new Set()
				: new Set(this.items().map((item) => item.id).filter((id): id is string => !!id))
		);
	}

	clearChecked(): void {
		if (this.checked().size) this.checked.set(new Set());
	}

	/** Only the rows still listed stay checked. */
	private pruneChecked(): void {
		const checked = this.checked();
		if (!checked.size) return;
		const listed = new Set(this.items().map((item) => item.id));
		const next = new Set([...checked].filter((id) => listed.has(id)));
		if (next.size !== checked.size) this.checked.set(next);
	}

	/**
	 * One change for every checked row, sent item by item (the API changes one recipient state at a time). The rows
	 * answered are updated as one row's change updates it; a row that failed stays checked and the failure is said.
	 */
	bulk(change: IInboxRecipientStateInput): void {
		const before = this.items().filter((item) => !!item.id && this.checked().has(item.id));
		if (!before.length || this.busy()) return;
		this.busy.set(true);
		this.actionError.set(null);
		// The list the rows belong to: another tab or filter chosen meanwhile is a list of its own, whose rows and
		// selection this answer must not touch.
		const scope = this.listScope;
		forkJoin(
			before.map((item) =>
				this.api.setState(item.id!, change).pipe(
					map((next) => ({ item, next: next as IInboxItemWithState | null })),
					catchError(() => of({ item, next: null as IInboxItemWithState | null }))
				)
			)
		).subscribe((results) => {
			this.busy.set(false);
			const answered = results.filter((result) => !!result.next);
			const sameList = scope === this.listScope;
			let removed = false;
			let items = this.items();
			for (const { next } of answered) {
				if (this.opened()?.id === next!.id) this.opened.set(next);
				if (!sameList) continue;
				if (this.leavesList(change, next!)) {
					items = items.filter((entry) => entry.id !== next!.id);
					removed = true;
					if (this.selectedId() === next!.id && !this.onlyRead(change)) this.selectedId.set(null);
				} else {
					items = replaceItem(items, next!);
				}
			}
			if (sameList) {
				this.items.set(items);
				// The rows that failed stay checked, for another try.
				this.checked.set(new Set(results.filter((result) => !result.next).map((result) => result.item.id!)));
			}
			if (answered.length < results.length) this.actionError.set('INBOX.BULK.FAILED');
			const undo = undoOf(change, before[0]);
			if (undo && answered.length) {
				this.offerUndo({
					kind: undo.kind,
					entries: answered.map(({ item }) => ({ id: item.id!, revert: undoOf(change, item)!.revert }))
				});
			}
			if (answered.length) this.api.notifyChanged();
			if (sameList && removed && this.nextCursor()) this.reload();
		});
	}

	// --- Undo -----------------------------------------------------------------------------------------------------

	/** "2 archived · Undo", for a few seconds (a newer change replaces it). */
	private offerUndo(undo: InboxUndo): void {
		this.clearUndoTimer();
		this.undo.set(undo);
		this.undoTimer = setTimeout(() => this.undo.set(null), INBOX_UNDO_MS);
	}

	dismissUndo(): void {
		this.clearUndoTimer();
		this.undo.set(null);
	}

	/** Takes the last change back, item by item, then reads the list again (the items come back where they were). */
	undoLast(): void {
		const undo = this.undo();
		if (!undo) return;
		this.dismissUndo();
		this.actionError.set(null);
		forkJoin(
			undo.entries.map((entry) =>
				this.api.setState(entry.id, entry.revert).pipe(
					map(() => true),
					catchError(() => of(false))
				)
			)
		).subscribe((done) => {
			if (done.some((ok) => !ok)) this.actionError.set('INBOX.UNDO.FAILED');
			this.api.notifyChanged();
			this.reload();
		});
	}

	private clearUndoTimer(): void {
		if (this.undoTimer) clearTimeout(this.undoTimer);
		this.undoTimer = null;
	}

	// --- Resizing the list ----------------------------------------------------------------------------------------

	startResize(event: PointerEvent): void {
		const handle = event.currentTarget as HTMLElement | null;
		const pane = handle?.parentElement;
		if (!handle || !pane || event.button !== 0) return;
		event.preventDefault();
		handle.setPointerCapture?.(event.pointerId);
		handle.classList.add('dragging');
		this.resizeStart = { x: event.clientX, width: pane.getBoundingClientRect().width };
	}

	resize(event: PointerEvent): void {
		if (!this.resizeStart) return;
		this.listWidth.set(this.clampWidth(this.resizeStart.width + event.clientX - this.resizeStart.x));
	}

	endResize(event: PointerEvent): void {
		if (!this.resizeStart) return;
		const handle = event.currentTarget as HTMLElement | null;
		handle?.releasePointerCapture?.(event.pointerId);
		handle?.classList.remove('dragging');
		this.resizeStart = null;
		storeListWidth(this.listWidth());
	}

	/** The arrow keys on the handle: 16px narrower or wider. */
	nudgeWidth(delta: number, event: Event): void {
		event.preventDefault();
		const pane = (event.currentTarget as HTMLElement | null)?.parentElement;
		const width = this.listWidth() ?? pane?.getBoundingClientRect().width ?? 352;
		this.listWidth.set(this.clampWidth(width + delta));
		storeListWidth(this.listWidth());
	}

	/** A double click on the handle: the list's own width again. */
	resetWidth(): void {
		this.listWidth.set(null);
		storeListWidth(null);
	}

	private clampWidth(width: number): number {
		return Math.round(Math.min(Math.max(width, LIST_WIDTH_MIN), LIST_WIDTH_MAX));
	}

	// --- The shortcuts sheet (a modal dialog) ---------------------------------------------------------------------

	/** Where focus was when the sheet opened: it goes back there when the sheet closes. */
	private focusBeforeSheet: HTMLElement | null = null;

	/** Opens the sheet and moves focus into it (its close button), as a modal dialog must. */
	openShortcuts(): void {
		if (this.shortcutsOpen()) return;
		const active = typeof document !== 'undefined' ? document.activeElement : null;
		this.focusBeforeSheet = active instanceof HTMLElement ? active : null;
		this.shortcutsOpen.set(true);
		afterNextRender(() => this.sheetFocusables()[0]?.focus(), { injector: this.injector });
	}

	/** Closes the sheet and gives focus back to where it was (the button, or the page, that opened it). */
	closeShortcuts(): void {
		if (!this.shortcutsOpen()) return;
		this.shortcutsOpen.set(false);
		const back = this.focusBeforeSheet;
		this.focusBeforeSheet = null;
		if (back?.isConnected) back.focus();
	}

	/** Tab and Shift+Tab cycle inside the sheet: the page under it cannot be reached while it is open. */
	keepFocusIn(event: Event): void {
		const focusables = this.sheetFocusables();
		event.preventDefault();
		if (!focusables.length) return;
		const index = focusables.indexOf(document.activeElement as HTMLElement);
		const step = (event as KeyboardEvent).shiftKey ? -1 : 1;
		focusables[(index + step + focusables.length) % focusables.length].focus();
	}

	private sheetFocusables(): HTMLElement[] {
		const sheet = this.host.nativeElement.querySelector<HTMLElement>('[data-test="shortcuts-sheet"]');
		if (!sheet) return [];
		return Array.from(
			sheet.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
		);
	}

	// --- Keyboard shortcuts ---------------------------------------------------------------------------------------

	/**
	 * The list's shortcuts (the "?" sheet lists them). Typing in a field, a key with Ctrl / Cmd / Alt, or a key inside
	 * a menu or an overlay (a select's options, a dialog) is never taken.
	 */
	onKeydown(event: KeyboardEvent): void {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.view() !== 'ready') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest?.('.cdk-overlay-container, [role="menu"], .menu-anchor')) return;
		const key = event.key;
		if (key === 'Escape') {
			if (this.shortcutsOpen()) this.closeShortcuts();
			else if (isTypingTarget(target)) return;
			else if (this.checked().size) this.clearChecked();
			else if (this.selectedId()) this.closeDetail();
			else return;
			event.preventDefault();
			return;
		}
		if (isTypingTarget(target)) return;
		if (key === '?') {
			if (this.shortcutsOpen()) this.closeShortcuts();
			else this.openShortcuts();
			event.preventDefault();
			return;
		}
		if (this.shortcutsOpen() || this.tab() === 'notifications') return;
		const handled = this.runShortcut(key);
		if (handled) event.preventDefault();
	}

	/** Runs a list shortcut; `false` for a key that is not one. */
	private runShortcut(key: string): boolean {
		const item = this.selected();
		switch (key) {
			case 'j':
				this.move(1);
				return true;
			case 'k':
				this.move(-1);
				return true;
			case '/':
				this.host.nativeElement.querySelector<HTMLInputElement>('[data-test="filter-q"]')?.focus();
				return true;
			case 'x':
				if (item) this.toggleChecked(item);
				return !!item;
			case 'r': {
				const reply = this.host.nativeElement.querySelector<HTMLTextAreaElement>('#inbox-reply-text');
				reply?.focus();
				return !!reply;
			}
		}
		// The rest change the open item, one change at a time.
		if (!item?.recipient || this.busy()) return false;
		switch (key) {
			case 'e':
				this.changeState(item, { isArchived: !isArchived(item) });
				return true;
			case 'd':
				this.changeState(item, { isDone: !isDone(item) });
				return true;
			case 'u':
				this.changeState(item, { isRead: isUnread(item) });
				return true;
			default:
				return false;
		}
	}

	/** j / k: the next or the previous row opens (from the first or the last when none is open). */
	private move(delta: 1 | -1): void {
		const items = this.items();
		if (!items.length) return;
		const index = items.findIndex((item) => item.id === this.selectedId());
		const next =
			index < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(Math.max(index + delta, 0), items.length - 1);
		if (next === index) return;
		const item = items[next];
		this.open(item);
		const row = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.row')).find(
			(element) => element.dataset['test'] === `item-${item.id}`
		);
		row?.scrollIntoView?.({ block: 'nearest' });
	}

	/** Only the read state changes: the open item stays open. */
	private onlyRead(change: IInboxRecipientStateInput): boolean {
		return (
			change.isRead !== undefined &&
			change.isArchived === undefined &&
			change.snoozedUntil === undefined &&
			change.isDone === undefined
		);
	}

	private refresh(id: string): void {
		this.api.get(id).subscribe({
			// "Already decided" elsewhere (409): the decided item leaves the Decisions tab too (#11098 review).
			next: (next) => this.useAnswered(next)
		});
	}
}
