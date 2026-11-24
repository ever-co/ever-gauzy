import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NbBadgeModule, NbIconModule, NbPopoverDirective, NbPopoverModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, forkJoin, merge, Observable, of, Subject, timer } from 'rxjs';
import { auditTime, catchError, filter, map, startWith, switchMap, take, takeUntil } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, ChatConversationKindEnum, IChatConversationWithState, IChatStates, IOrganization, IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { CHAT_BADGE_POLL_MS, CHAT_LINK, CHAT_LIVE_LIST_AUDIT_MS } from '../../chat-ui.constants';
import { badgeText, ChatPerson, conversationPerson, conversationTitle, hasMessages, isUnread } from '../../chat-ui.helpers';
import { ChatAvailabilityService, isFinalRefusal } from '../../services/chat-availability.service';
import { ChatHint, coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** How many conversations the header's dropdown lists; the rest is one click away on the chat page. */
export const CHAT_HEADER_MENU_SIZE = 6;

/** How many conversations hold unread messages, plus the followed threads with unread replies. */
export function unreadOf(states: IChatStates | null | undefined): number {
	const conversations = (states?.states ?? []).filter((state) => (state.unreadCount ?? 0) > 0 || (state.mentionCount ?? 0) > 0).length;
	const threads = (states?.threads ?? []).filter((thread) => (thread.unreadReplies ?? 0) > 0).length;
	return conversations + threads;
}

/** The chat events that can move the badge's count: my state, a message created or deleted, a thread, a membership. */
const BADGE_EVENTS = new Set<string>([
	CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED,
	CHAT_EVENT_NAMES.MESSAGE_CREATED,
	CHAT_EVENT_NAMES.MESSAGE_DELETED,
	CHAT_EVENT_NAMES.THREAD_CHANGED,
	CHAT_EVENT_NAMES.CONVERSATION_CHANGED
]);

/** Whether a chat event can change how many conversations and threads hold something unread. */
export function movesBadge(hint: Pick<ChatHint, 'name'>): boolean {
	return BADGE_EVENTS.has(hint.name);
}

/** One row of the header's dropdown: a conversation with its name, face, unread state and last activity. */
export interface ChatMenuRow {
	id: string;
	title: string;
	person: ChatPerson | null;
	channel: boolean;
	unread: boolean;
	/** The pill's text: the unread count, or empty when only a mention marks the conversation unread. */
	count: string;
	at: Date | string | null;
}

/**
 * The dropdown's rows: the conversations that hold messages and are not archived, newest activity first, at most
 * `limit` of them. A channel's row draws its own `#` mark, so its title is the bare name (not `#name`).
 */
export function menuRows(
	conversations: readonly IChatConversationWithState[],
	people: ChatPeople,
	meEmployeeId: string | null,
	fallback: string,
	limit = CHAT_HEADER_MENU_SIZE
): ChatMenuRow[] {
	const time = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() || 0 : 0);
	return conversations
		.filter((conversation) => !conversation.archivedAt && hasMessages(conversation))
		.sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt))
		.slice(0, limit)
		.map((conversation) => {
			const channel = conversation.kind === ChatConversationKindEnum.CHANNEL;
			return {
				id: String(conversation.id),
				title: channel ? conversation.name?.trim() || fallback : conversationTitle(conversation, people.byEmployee, meEmployeeId, fallback),
				person: conversationPerson(conversation, people.byEmployee, meEmployeeId),
				channel,
				unread: isUnread(conversation),
				count: badgeText(conversation.state?.unreadCount ?? 0),
				at: conversation.lastMessageAt ?? null
			};
		});
}

/** The `DatePipe` format of a row's time: the time for today, the day and month for this year, the date before. */
export function menuDateFormat(value: Date | string | null | undefined, now: Date = new Date()): string {
	const date = value ? new Date(value) : null;
	if (!date || Number.isNaN(date.getTime())) return 'short';
	if (date.toDateString() === now.toDateString()) return 'shortTime';
	if (date.getFullYear() === now.getFullYear()) return 'MMM d';
	return 'mediumDate';
}

type MenuState = 'loading' | 'ready' | 'error';

/**
 * The chat icon of the header with the count of conversations and threads holding something unread. A click opens a
 * dropdown of my latest conversations (read when it opens); a row opens that conversation and "See all" the chat page.
 */
@Component({
	selector: 'ngx-chat-header-badge',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbBadgeModule, NbIconModule, NbPopoverModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<button
			type="button"
			class="chat-badge"
			data-test="chat-badge"
			[nbPopover]="menu"
			nbPopoverTrigger="click"
			nbPopoverPlacement="bottom-start"
			nbPopoverAdjustment="noop"
			[nbPopoverOffset]="8"
			nbPopoverClass="chat-header-menu-popover"
			(nbPopoverShowStateChange)="onShowChange($event.isShown)"
			aria-haspopup="true"
			[attr.aria-expanded]="open()"
			[attr.aria-label]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
			[attr.title]="'CHAT.BADGE_LABEL' | translate: { count: unread() }"
		>
			<nb-icon icon="message-circle-outline"></nb-icon>
			@if (text()) {
				<nb-badge data-test="chat-badge-count" [text]="text()" status="danger" position="top right"></nb-badge>
			}
		</button>

		<ng-template #menu>
			<div class="menu" data-test="chat-menu">
				<div class="menu-head">{{ 'CHAT.TITLE' | translate }}</div>
				<div class="menu-body">
					@switch (state()) {
						@case ('loading') {
							<p class="menu-note">{{ 'CHAT.LOADING' | translate }}</p>
						}
						@case ('error') {
							<p class="menu-note">{{ 'CHAT.HEADER_MENU.ERROR' | translate }}</p>
						}
						@default {
							@for (row of rows(); track row.id) {
								<a class="row" [class.unread]="row.unread" [routerLink]="[link, row.id]" [attr.data-test]="'chat-menu-' + row.id" (click)="close()">
									@if (row.channel) {
										<span class="channel-mark" aria-hidden="true">#</span>
									} @else {
										<ngx-chat-person-avatar [person]="row.person" [fallbackName]="row.title" size="small"></ngx-chat-person-avatar>
									}
									<span class="row-title">{{ row.title }}</span>
									<span class="row-end">
										@if (row.at) {
											<time class="row-time" [attr.datetime]="row.at">{{ row.at | date: dateFormat(row.at) }}</time>
										}
										@if (row.count) {
											<span class="row-count">{{ row.count }}</span>
										} @else if (row.unread) {
											<span class="row-dot" aria-hidden="true"></span>
										}
									</span>
								</a>
							} @empty {
								<p class="menu-note">{{ 'CHAT.HEADER_MENU.EMPTY' | translate }}</p>
							}
						}
					}
				</div>
				<a class="menu-all" data-test="chat-menu-all" [routerLink]="link" (click)="close()">{{ 'CHAT.HEADER_MENU.SEE_ALL' | translate }}</a>
			</div>
		</ng-template>
	`,
	styles: [
		`
			.chat-badge {
				position: relative;
				display: inline-flex;
				align-items: center;
				padding: 0 0.25rem;
				border: 0;
				background: none;
				color: inherit;
				font: inherit;
				cursor: pointer;
			}
			.menu {
				display: flex;
				flex-direction: column;
				box-sizing: border-box;
				width: 260px;
				max-width: calc(100vw - 32px);
			}
			.menu-head {
				padding: 12px 16px 8px;
				font-size: 13px;
				font-weight: 600;
				color: var(--gauzy-text-color-1);
			}
			.menu-body {
				max-height: 320px;
				overflow-x: hidden;
				overflow-y: auto;
				padding: 0 0 4px;
			}
			.menu-note {
				margin: 0;
				padding: 12px 16px;
				font-size: 12px;
				color: var(--gauzy-text-color-2);
			}
			.menu .row {
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
				margin: 0 8px;
				padding: 8px;
				border-radius: calc(var(--border-radius) * 0.75);
				color: var(--gauzy-text-color-1);
				text-decoration: none;
				font-size: 12px;
				line-height: 16px;
			}
			.menu .row:hover,
			.menu .row:focus-visible {
				background: var(--gauzy-hover-tint);
				text-decoration: none;
				color: var(--gauzy-text-color-1);
			}
			.channel-mark {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				border-radius: calc(var(--border-radius) * 0.75);
				background: var(--background-basic-color-3);
				color: var(--gauzy-text-color-2);
				font-size: 11px;
				font-weight: 600;
			}
			.row-title {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.row.unread .row-title {
				font-weight: 600;
			}
			.row-end {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				gap: 6px;
			}
			.row-time {
				font-size: 11px;
				color: var(--gauzy-text-color-2);
			}
			.row-count {
				min-width: 16px;
				padding: 0 5px;
				border-radius: calc(var(--border-radius) * 2);
				background: var(--color-danger-default);
				color: var(--text-control-color);
				font-size: 10px;
				font-weight: 600;
				line-height: 16px;
				text-align: center;
			}
			.row-dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				background: var(--color-danger-default);
			}
			.menu-all {
				display: block;
				margin-top: 4px;
				padding: 10px 16px;
				border-top: 1px solid var(--border-basic-color-3);
				color: var(--color-primary-default);
				font-size: 12px;
				font-weight: 600;
				text-align: center;
				text-decoration: none;
			}
			.menu-all:hover,
			.menu-all:focus-visible {
				background: var(--gauzy-hover-tint);
				text-decoration: none;
			}
			/* The popover frame around the panel (no arrow, no padding, its offset) is styled with the other overlays:
			   .chat-header-menu-popover in ui-core's _overlays.scss. */
		`
	]
})
export class ChatHeaderBadgeComponent implements OnInit {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly availability = inject(ChatAvailabilityService);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly store = inject(Store);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly popover = viewChild(NbPopoverDirective);
	/** A final refusal (the chat went away for this scope) stops the polling until the scope changes. */
	private readonly refused$ = new Subject<void>();
	/** Asks for the dropdown's conversations (each time it opens). */
	private readonly loadMenu$ = new Subject<void>();

	protected readonly link = CHAT_LINK;
	protected readonly unread = signal(0);
	protected readonly text = signal('');
	protected readonly open = signal(false);
	protected readonly state = signal<MenuState>('loading');
	protected readonly rows = signal<ChatMenuRow[]>([]);

	ngOnInit(): void {
		this.startPolling();
		this.followMenu();
	}

	protected onShowChange(isShown: boolean): void {
		this.open.set(isShown);
		if (!isShown) return;
		// Rows already shown stay while they are read again (an earlier failure no longer shows over them); only an
		// opening without rows says "Loading…".
		this.state.set(this.rows().length ? 'ready' : 'loading');
		this.loadMenu$.next();
	}

	protected close(): void {
		this.popover()?.hide();
	}

	protected dateFormat(value: Date | string | null): string {
		return menuDateFormat(value);
	}

	/**
	 * Reads the dropdown's conversations at each opening, anew for every scope the chat is served in: a change of user
	 * or organization clears the rows of the scope before and cancels its read still on the way, so they never show
	 * under the new one. An open dropdown reads the new scope's at once.
	 */
	private followMenu(): void {
		this.availability.scope$
			.pipe(
				switchMap((scope) => {
					this.rows.set([]);
					this.state.set('loading');
					if (!scope) return EMPTY;
					const asks$ = this.open() ? this.loadMenu$.pipe(startWith(undefined)) : this.loadMenu$;
					return asks$.pipe(switchMap(() => this.readMenu()));
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((rows) => {
				if (rows) this.rows.set(rows);
				this.state.set(rows ? 'ready' : 'error');
			});
	}

	/** My conversations with the people's names and faces, as rows; `null` when they could not be read. */
	private readMenu(): Observable<ChatMenuRow[] | null> {
		const organization = this.store.selectedOrganization as IOrganization | null;
		const user = this.store.user as (IUser & { employeeId?: string }) | null;
		const meEmployeeId = user?.employee?.id ? String(user.employee.id) : user?.employeeId ? String(user.employeeId) : null;
		const people$ =
			organization?.id && organization.tenantId
				? this.peopleService.people(organization.id, organization.tenantId).pipe(take(1))
				: of(EMPTY_PEOPLE);
		return forkJoin({ list: this.api.listMine(), people: people$ }).pipe(
			map(({ list, people }) => menuRows(list?.conversations ?? [], people, meEmployeeId, this.translate.instant('CHAT.UNNAMED'))),
			catchError(() => of(null))
		);
	}

	/**
	 * Reads my states, anew for every scope the chat is served in: at once, after every write of the page, when a chat
	 * event that moves a count arrives (live; a burst is read once), after a reconnect, and on a timer as the fallback.
	 */
	private startPolling(): void {
		this.availability.scope$
			.pipe(
				switchMap((scope) => {
					this.show(0);
					if (!scope) return EMPTY;
					const events$ = this.live.hints$.pipe(
						filter((hint) => movesBadge(hint) && isTabVisible()),
						auditTime(CHAT_LIVE_LIST_AUDIT_MS)
					);
					return merge(timer(0), this.live.ticks(CHAT_BADGE_POLL_MS), this.api.changed$, events$, this.live.catchUp$).pipe(
						// A read under way finishes; triggers meanwhile ask for one more after it.
						coalesceReads(() => this.readStates()),
						takeUntil(this.refused$)
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((states) => this.show(unreadOf(states)));
	}

	private readStates() {
		return this.api.states().pipe(
			catchError((error: HttpErrorResponse) => {
				if (isFinalRefusal(error)) {
					this.show(0);
					this.refused$.next();
				}
				return EMPTY;
			})
		);
	}

	private show(unread: number): void {
		this.unread.set(unread);
		this.text.set(badgeText(unread));
	}
}
