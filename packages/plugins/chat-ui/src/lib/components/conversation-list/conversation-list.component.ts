import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatConversationKindEnum, ChatNotifyLevelEnum, ChatVisibilityEnum, IChatCategory, IChatConversationWithState } from '@gauzy/contracts';
import { sortCategories } from '../../chat-categories';
import { CHAT_COLLAPSED_SECTIONS_KEY, CHAT_LINK, CHAT_THREADS_PATH, CHAT_UNREADS_PATH } from '../../chat-ui.constants';
import { ChatPerson, conversationPerson, conversationTitle, groupShortTitle, hasMessages, isUnread, otherMemberCount } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

export type ChatListView = 'conversation' | 'unreads' | 'threads';

/** One collapsible block of the sidebar. */
interface ChatListSection {
	key: string;
	/** A category's own name; null for a built-in section (its label is translated). */
	name: string | null;
	labelKey: string;
	add: 'channel' | 'direct' | null;
	conversations: IChatConversationWithState[];
}

/**
 * The sections that always open expanded when the page loads: the person may fold them, but only until the next
 * visit (their folded state is never remembered, and one remembered from before is ignored).
 */
const OPEN_ON_LOAD_SECTIONS: ReadonlySet<string> = new Set(['channels', 'direct']);

function readCollapsed(): Set<string> {
	try {
		const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAT_COLLAPSED_SECTIONS_KEY) : null;
		const keys = raw ? (JSON.parse(raw) as unknown) : [];
		return new Set(Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string' && !OPEN_ON_LOAD_SECTIONS.has(key)) : []);
	} catch {
		return new Set();
	}
}

/**
 * Whether the browser runs on a Mac or an iOS device (the shortcut label then reads ⌘K): from the User-Agent Client
 * Hints where the browser has them, else from the deprecated `navigator.platform`.
 */
function isApplePlatform(): boolean {
	if (typeof navigator === 'undefined') return false;
	const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
	return /Mac|iP(hone|ad|od)/i.test(hinted || navigator.platform || '');
}

/** Whether a key went to a place that edits text (an input, a text box, a select, an editable element). */
function isEditable(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element?.tagName) return false;
	return /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable;
}

function writeCollapsed(keys: ReadonlySet<string>): void {
	try {
		const remembered = [...keys].filter((key) => !OPEN_ON_LOAD_SECTIONS.has(key));
		if (typeof localStorage !== 'undefined') localStorage.setItem(CHAT_COLLAPSED_SECTIONS_KEY, JSON.stringify(remembered));
	} catch {
		// Storage refused (a private window, a full quota): the sections simply open expanded next time.
	}
}

/**
 * The left pane, laid out as chat apps do: the workspace header with its compose actions, a "Jump to…" filter
 * (Ctrl/⌘+K), Unreads and Threads, then the sections (favourites, the channels by category, the direct messages)
 * with an add button each. Every section collapses (its header then counts its unread conversations). Channels and
 * Direct messages always open expanded when the page loads; for favourites and channel categories, which are
 * collapsed is remembered per browser. Alt+↑ / Alt+↓ moves to the previous / next conversation.
 */
@Component({
	selector: 'ngx-chat-conversation-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'(document:keydown)': 'onDocumentKey($event)'
	},
	imports: [NgTemplateOutlet, RouterLink, NbIconModule, NbTooltipModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<div class="list" data-test="chat-list">
			<header class="workspace">
				<h2 class="workspace-name">{{ 'CHAT.TITLE' | translate }}</h2>
				<button type="button" class="icon-button" data-test="new-channel" [nbTooltip]="'CHAT.LIST.NEW_CHANNEL' | translate" [attr.aria-label]="'CHAT.LIST.NEW_CHANNEL' | translate" (click)="newChannel.emit()">
					<nb-icon icon="hash-outline"></nb-icon>
				</button>
				<button type="button" class="icon-button" data-test="new-message" [nbTooltip]="'CHAT.LIST.NEW_MESSAGE' | translate" [attr.aria-label]="'CHAT.LIST.NEW_MESSAGE' | translate" (click)="newDirect.emit()">
					<nb-icon icon="edit-2-outline"></nb-icon>
				</button>
			</header>

			<label class="jump">
				<nb-icon icon="search-outline"></nb-icon>
				<input
					#search
					type="text"
					data-test="jump-to"
					autocomplete="off"
					[placeholder]="'CHAT.LIST.JUMP_TO' | translate"
					[attr.aria-label]="'CHAT.LIST.JUMP_TO' | translate"
					[value]="query()"
					(input)="query.set(asInput($event).value)"
					(keydown)="onSearchKey($event)"
				/>
				@if (query()) {
					<button type="button" class="clear" [attr.aria-label]="'CHAT.VIEW.CLOSE' | translate" (click)="clearSearch()"><nb-icon icon="close-outline"></nb-icon></button>
				} @else {
					<kbd>{{ shortcut }}</kbd>
				}
			</label>

			<div class="scroll">
				@if (query()) {
					<h3 class="results-title">{{ 'CHAT.LIST.RESULTS' | translate }}</h3>
					@for (conversation of matches(); track conversation.id) {
						<ng-container *ngTemplateOutlet="row; context: { $implicit: conversation }"></ng-container>
					} @empty {
						<p class="empty">{{ 'CHAT.LIST.NO_MATCHES' | translate: { query: query() } }}</p>
					}
				} @else {
					<nav class="views">
						<a class="row view" [class.active]="view() === 'unreads'" [routerLink]="unreadsLink" data-test="view-unreads">
							<span class="row-icon"><nb-icon icon="radio-button-on-outline"></nb-icon></span>
							<span class="title">{{ 'CHAT.LIST.UNREADS' | translate }}</span>
							@if (unreadCount() > 0) {
								<span class="count">{{ unreadCount() }}</span>
							}
						</a>
						<a class="row view" [class.active]="view() === 'threads'" [routerLink]="threadsLink" data-test="view-threads">
							<span class="row-icon"><nb-icon icon="message-square-outline"></nb-icon></span>
							<span class="title">{{ 'CHAT.LIST.THREADS' | translate }}</span>
							@if (threadCount() > 0) {
								<span class="count mention">{{ threadCount() }}</span>
							}
						</a>
					</nav>

					@for (section of sections(); track section.key) {
						@let label = section.name ?? (section.labelKey | translate);
						@let collapsed = isCollapsed(section.key);
						<section class="section" [attr.data-test]="'section-' + section.key">
							<div class="section-header">
								<button
									type="button"
									class="section-toggle"
									[attr.aria-expanded]="!collapsed"
									[attr.aria-label]="'CHAT.LIST.TOGGLE_SECTION' | translate: { name: label }"
									(click)="toggle(section.key)"
								>
									<nb-icon class="caret" [class.collapsed]="collapsed" icon="arrow-ios-downward-outline"></nb-icon>
									<span>{{ label }}</span>
									@if (collapsed) {
										@let hidden = unreadIn(section);
										@if (hidden > 0) {
											<span class="count section-count" [attr.aria-label]="'CHAT.LIST.UNREAD_IN' | translate: { count: hidden }">{{ hidden }}</span>
										}
									}
								</button>
								@if (section.add === 'channel') {
									<button type="button" class="section-add" [nbTooltip]="'CHAT.LIST.ADD_CHANNEL' | translate" [attr.aria-label]="'CHAT.LIST.ADD_CHANNEL' | translate" (click)="newChannel.emit()">
										<nb-icon icon="plus-outline"></nb-icon>
									</button>
								} @else if (section.add === 'direct') {
									<button type="button" class="section-add" [nbTooltip]="'CHAT.LIST.ADD_DIRECT' | translate" [attr.aria-label]="'CHAT.LIST.ADD_DIRECT' | translate" (click)="newDirect.emit()">
										<nb-icon icon="plus-outline"></nb-icon>
									</button>
								}
							</div>
							@for (conversation of shown(section); track conversation.id) {
								<ng-container *ngTemplateOutlet="row; context: { $implicit: conversation }"></ng-container>
							}
							@if (!collapsed) {
								@if (section.key === 'channels' && section.conversations.length === 0) {
									<p class="empty">{{ 'CHAT.LIST.NO_CHANNELS' | translate }}</p>
								}
								@if (section.key === 'direct' && section.conversations.length === 0) {
									<p class="empty">{{ 'CHAT.LIST.NO_DIRECT' | translate }}</p>
								}
								@if (section.key === lastChannelSection()) {
									<button type="button" class="row add-row" data-test="browse-channels" (click)="browse.emit()">
										<span class="row-icon add-icon"><nb-icon icon="search-outline"></nb-icon></span>
										<span class="title">{{ 'CHAT.LIST.BROWSE' | translate }}</span>
									</button>
									@if (canManageCategories()) {
										<button type="button" class="row add-row" data-test="manage-categories" (click)="manageCategories.emit()">
											<span class="row-icon add-icon"><nb-icon icon="folder-outline"></nb-icon></span>
											<span class="title">{{ 'CHAT.CATEGORIES.TITLE' | translate }}</span>
										</button>
									}
								}
								@if (section.key === 'direct') {
									<button type="button" class="row add-row" (click)="newDirect.emit()">
										<span class="row-icon add-icon"><nb-icon icon="plus-outline"></nb-icon></span>
										<span class="title">{{ 'CHAT.LIST.NEW_MESSAGE' | translate }}</span>
									</button>
								}
							}
						</section>
					}
				}
			</div>
		</div>

		<ng-template #row let-conversation>
			@let person = personOf(conversation);
			<a
				class="row"
				[class.active]="conversation.id === activeId()"
				[class.unread]="unread(conversation)"
				[class.muted]="conversation.state?.notifyLevel === mutedLevel"
				[routerLink]="link(conversation.id)"
				[attr.data-test]="'conversation-' + conversation.id"
				(click)="query() && clearSearch()"
			>
				@let others = othersOf(conversation);
				<span class="row-icon">
					@if (conversation.kind === 'channel') {
						<nb-icon [icon]="conversation.visibility === privateVisibility ? 'lock-outline' : 'hash-outline'"></nb-icon>
					} @else if (conversation.kind === 'group' && others > 0) {
						<!-- A group: how many people besides me, on a tile the size of an avatar. -->
						<span class="group-count" aria-hidden="true">{{ others }}</span>
					} @else if (conversation.kind === 'group' || !person) {
						<nb-icon icon="people-outline"></nb-icon>
					} @else {
						<ngx-chat-person-avatar [person]="person" size="tiny"></ngx-chat-person-avatar>
					}
				</span>
				<!-- A direct or group row may be cut short: hovering it tells every name. -->
				<span class="title" [attr.title]="conversation.kind === 'channel' ? null : title(conversation)">{{ rowTitle(conversation) }}</span>
				@if (conversation.state?.notifyLevel === mutedLevel) {
					<nb-icon class="muted-icon" icon="bell-off-outline"></nb-icon>
				}
				@if (conversation.state?.mentionCount > 0) {
					<span class="count mention">{{ conversation.state.mentionCount }}</span>
				} @else if (conversation.state?.unreadCount > 0) {
					<span class="count">{{ conversation.state.unreadCount }}</span>
				}
			</a>
		</ng-template>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
			}
			.list {
				display: flex;
				flex-direction: column;
				height: 100%;
				min-height: 0;
				background: var(--chat-sidebar-bg, transparent);
			}
			/*
			 * One inset lines everything up: the sidebar's content sits 0.75rem from its edges, and every row's icon
			 * column (1.25rem, then a 0.5rem gap) starts 0.5rem into the row, so the header title, the search icon,
			 * the row icons, the section carets and the empty texts share the same left edges.
			 */
			.workspace {
				display: flex;
				align-items: center;
				gap: 0.125rem;
				height: var(--chat-header-height, 3.5rem);
				padding: 0 0.75rem 0 1.25rem;
				border-bottom: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				flex: 0 0 auto;
			}
			.workspace-name {
				flex: 1 1 auto;
				margin: 0;
				color: var(--chat-text, inherit);
				font-size: 1rem;
				font-weight: 800;
				letter-spacing: -0.01em;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.icon-button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				padding: 0;
				border: 0;
				border-radius: 0.5rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
				transition: background-color 0.12s ease, color 0.12s ease;
			}
			.icon-button nb-icon {
				font-size: 1rem;
			}
			.icon-button:hover,
			.icon-button:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
			}
			.jump {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				height: 2rem;
				margin: 0.75rem 0.75rem 0.5rem;
				padding: 0 0.375rem 0 0.5rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
				border-radius: 0.5rem;
				background: var(--chat-bg, transparent);
				color: var(--chat-muted, inherit);
				cursor: text;
				transition: border-color 0.12s ease, box-shadow 0.12s ease;
				flex: 0 0 auto;
			}
			.jump:hover {
				border-color: var(--chat-border-strong, rgba(127, 127, 127, 0.35));
			}
			.jump:focus-within {
				border-color: var(--chat-accent, #3366ff);
				box-shadow: 0 0 0 3px var(--chat-accent-soft, rgba(51, 102, 255, 0.15));
			}
			.jump > nb-icon {
				width: 1.25rem;
				font-size: 0.875rem;
				flex: 0 0 auto;
			}
			/* The app styles every text input (border, fill, padding, focus ring): none of that belongs inside the box. */
			.jump input,
			.jump input:hover,
			.jump input:focus {
				flex: 1 1 auto;
				width: auto;
				min-width: 0;
				height: 100% !important;
				margin: 0 !important;
				padding: 0 !important;
				border: 0 !important;
				border-radius: 0 !important;
				outline: 0 !important;
				box-shadow: none !important;
				background: transparent !important;
				appearance: none;
				color: var(--chat-text, inherit);
				font: inherit;
				font-size: 0.8125rem;
			}
			.jump input::placeholder {
				color: var(--chat-muted, inherit);
				opacity: 1;
			}
			.jump kbd {
				flex: 0 0 auto;
				padding: 0.125rem 0.375rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.25));
				border-radius: 0.3125rem;
				background: var(--chat-elevated, rgba(127, 127, 127, 0.1));
				box-shadow: none;
				color: var(--chat-muted, inherit);
				font-family: inherit;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 0.875rem;
				white-space: nowrap;
			}
			.clear {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.5rem;
				height: 1.5rem;
				padding: 0;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: inherit;
				cursor: pointer;
			}
			.clear:hover {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
			}
			.scroll {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				overflow-x: hidden;
				padding: 0.25rem 0.75rem 1rem;
				scrollbar-width: thin;
			}
			.views {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding-bottom: 0.75rem;
				border-bottom: 1px solid var(--chat-border, rgba(127, 127, 127, 0.2));
			}
			.section {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				margin-top: 1rem;
			}
			.section-header {
				display: flex;
				align-items: center;
				gap: 0.25rem;
				margin-bottom: 0.125rem;
			}
			.section-toggle {
				flex: 1 1 auto;
				display: inline-flex;
				align-items: center;
				gap: 0.5rem;
				min-width: 0;
				height: 1.625rem;
				padding: 0 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				font: inherit;
				font-size: 0.75rem;
				font-weight: 700;
				text-align: left;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.section-toggle span {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			/* A collapsed section's unread count, at the end of its header. */
			.section-toggle .section-count {
				flex: 0 0 auto;
				margin-left: auto;
				overflow: visible;
			}
			.section-toggle:hover,
			.section-toggle:focus-visible {
				color: var(--chat-text, inherit);
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.caret {
				width: 1.25rem;
				font-size: 0.75rem;
				flex: 0 0 auto;
				transition: transform 0.15s ease;
			}
			.caret.collapsed {
				transform: rotate(-90deg);
			}
			.section-add {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				flex: 0 0 auto;
				padding: 0;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				cursor: pointer;
				opacity: 0;
				transition: opacity 0.12s ease, background-color 0.1s ease;
			}
			.section-add nb-icon {
				font-size: 1rem;
			}
			.section-header:hover .section-add,
			.section-add:focus-visible {
				opacity: 1;
			}
			.section-add:hover {
				color: var(--chat-text, inherit);
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
			}
			.results-title {
				margin: 0.25rem 0.5rem 0.375rem;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				font-weight: 700;
			}
			/*
			 * One line, always: the app's global Bootstrap \`.row\` (its grid) sets \`flex-wrap: wrap\` and -15px side margins,
			 * which put a long title (a group's names) on a line of its own under the icon, outside the row.
			 */
			.row {
				display: flex;
				flex-wrap: nowrap;
				align-items: center;
				gap: 0.5rem;
				box-sizing: border-box;
				width: 100%;
				height: 1.875rem;
				margin: 0;
				padding: 0 0.5rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--chat-muted, inherit);
				font: inherit;
				font-size: 0.8125rem;
				line-height: 1;
				text-align: left;
				text-decoration: none;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.row.unread {
				color: var(--chat-text, inherit);
			}
			.row.unread .title {
				font-weight: 700;
			}
			.row.muted {
				opacity: 0.55;
			}
			/* The open row carries the same soft tint as a hovered one, so the selection and the pointer read the same. */
			.row.active,
			.row:hover,
			.row:focus-visible,
			a.row.active:hover,
			a.row:hover,
			a.row:focus-visible {
				background: var(--chat-hover, rgba(127, 127, 127, 0.12));
				color: var(--chat-text, inherit);
				text-decoration: none;
				opacity: 1;
				outline: none;
			}
			.row.active .title {
				font-weight: 700;
			}
			.row-icon {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.25rem;
				height: 1.25rem;
				flex: 0 0 auto;
			}
			.row-icon nb-icon {
				font-size: 1rem;
			}
			.add-icon {
				border-radius: 0.3125rem;
				background: var(--chat-elevated, rgba(127, 127, 127, 0.15));
			}
			/* A group's tile: the count of its people, in the place and the size of a direct row's avatar. */
			.group-count {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.25rem;
				height: 1.25rem;
				border-radius: 0.25rem;
				background: var(--chat-elevated, rgba(127, 127, 127, 0.18));
				color: var(--chat-text-soft, inherit);
				font-size: 0.625rem;
				font-weight: 700;
				line-height: 1;
				font-variant-numeric: tabular-nums;
			}
			.add-icon nb-icon {
				font-size: 0.75rem;
			}
			.title {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				line-height: 1.25rem;
			}
			.muted-icon {
				font-size: 0.75rem;
				flex: 0 0 auto;
			}
			.count {
				flex: 0 0 auto;
				min-width: 1.25rem;
				height: 1.125rem;
				padding: 0 0.375rem;
				border-radius: 999px;
				background: var(--chat-active-tint, rgba(127, 127, 127, 0.25));
				color: var(--chat-text, inherit);
				font-size: 0.625rem;
				font-weight: 700;
				line-height: 1.125rem;
				text-align: center;
			}
			.count.mention {
				background: var(--chat-danger, #e4493f);
				color: #fff;
			}
			.empty {
				margin: 0;
				padding: 0.375rem 0.5rem 0.375rem 2.25rem;
				color: var(--chat-muted, inherit);
				font-size: 0.75rem;
				line-height: 1.25rem;
			}
		`
	]
})
export class ConversationListComponent {
	private readonly router = inject(Router);

	readonly conversations = input.required<readonly IChatConversationWithState[]>();
	readonly categories = input<readonly IChatCategory[]>([]);
	readonly people = input.required<ChatPeople>();
	readonly meEmployeeId = input<string | null>(null);
	readonly activeId = input<string | null>(null);
	readonly view = input<ChatListView>('conversation');
	readonly threadCount = input(0);
	readonly untitled = input('Conversation');
	/** `CHAT_MANAGE`: offers the categories of the channels to manage. */
	readonly canManageCategories = input(false);

	readonly newChannel = output<void>();
	readonly newDirect = output<void>();
	readonly browse = output<void>();
	readonly manageCategories = output<void>();

	private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

	protected readonly unreadsLink = `${CHAT_LINK}/${CHAT_UNREADS_PATH}`;
	protected readonly threadsLink = `${CHAT_LINK}/${CHAT_THREADS_PATH}`;
	protected readonly privateVisibility = ChatVisibilityEnum.PRIVATE;
	protected readonly mutedLevel = ChatNotifyLevelEnum.MUTED;
	protected readonly shortcut = isApplePlatform() ? '⌘K' : 'Ctrl K';

	protected readonly query = signal('');
	private readonly collapsed = signal<ReadonlySet<string>>(readCollapsed());

	protected readonly unreadCount = computed(() => this.conversations().filter(isUnread).length);
	protected readonly favorites = computed(() => this.conversations().filter((conversation) => conversation.state?.isFavorite));
	protected readonly channels = computed(() =>
		this.conversations().filter((conversation) => conversation.kind === ChatConversationKindEnum.CHANNEL && !conversation.state?.isFavorite)
	);
	/**
	 * Every direct and group conversation, favourites included: Favourites is a shortcut list on top, so a person
	 * added to it stays in Direct messages too. (A favourite channel moves to Favourites.) A direct conversation nobody
	 * has written in yet is left out: opening a conversation with someone does not list them until a message is sent.
	 * A group is listed as soon as it exists, as before (someone added me to it, or I made it in "New message").
	 */
	protected readonly direct = computed(() =>
		this.conversations().filter(
			(conversation) =>
				conversation.kind !== ChatConversationKindEnum.CHANNEL &&
				(conversation.kind !== ChatConversationKindEnum.DIRECT || hasMessages(conversation))
		)
	);

	/** The channels under their category (in category order), the uncategorized ones first. */
	protected readonly channelGroups = computed(() => {
		const channels = this.channels();
		if (channels.length === 0) return [];
		// The order the categories dialog shows and moves them in.
		const categories = sortCategories(this.categories());
		const groups: { key: string; name: string | null; conversations: IChatConversationWithState[] }[] = [];
		const uncategorized = channels.filter((conversation) => !conversation.categoryId);
		if (uncategorized.length > 0) groups.push({ key: 'none', name: null, conversations: uncategorized });
		for (const category of categories) {
			const members = channels.filter((conversation) => String(conversation.categoryId) === String(category.id));
			if (members.length > 0) groups.push({ key: String(category.id), name: category.name, conversations: members });
		}
		const known = new Set(categories.map((category) => String(category.id)));
		const orphans = channels.filter((conversation) => conversation.categoryId && !known.has(String(conversation.categoryId)));
		if (orphans.length > 0) {
			const first = groups.find((group) => group.key === 'none');
			if (first) first.conversations.push(...orphans);
			else groups.push({ key: 'none', name: null, conversations: orphans });
		}
		return groups;
	});

	/** The sidebar's sections in order: favourites (when any), the channel groups (always one), the direct messages. */
	protected readonly sections = computed<ChatListSection[]>(() => {
		const sections: ChatListSection[] = [];
		if (this.favorites().length > 0) {
			sections.push({ key: 'favorites', name: null, labelKey: 'CHAT.LIST.FAVORITES', add: null, conversations: this.favorites() });
		}
		const groups = this.channelGroups();
		if (groups.length === 0) {
			sections.push({ key: 'channels', name: null, labelKey: 'CHAT.LIST.CHANNELS', add: 'channel', conversations: [] });
		}
		for (const group of groups) {
			const key = group.key === 'none' ? 'channels' : `category:${group.key}`;
			sections.push({ key, name: group.name, labelKey: 'CHAT.LIST.CHANNELS', add: group.key === 'none' ? 'channel' : null, conversations: group.conversations });
		}
		sections.push({ key: 'direct', name: null, labelKey: 'CHAT.LIST.DIRECT', add: 'direct', conversations: this.direct() });
		return sections;
	});

	/** The channel section that ends with "Browse channels" (the last one of channels). */
	protected readonly lastChannelSection = computed(() => {
		const channelSections = this.sections().filter((section) => section.key === 'channels' || section.key.startsWith('category:'));
		return channelSections[channelSections.length - 1]?.key ?? 'channels';
	});

	/** The conversations whose title holds the query, unread ones first. */
	protected readonly matches = computed(() => {
		const query = this.query().trim().toLowerCase().replace(/^[#@]/, '');
		if (!query) return [];
		return this.conversations()
			.filter((conversation) => this.title(conversation).toLowerCase().replace(/^#/, '').includes(query))
			.sort((a, b) => Number(isUnread(b)) - Number(isUnread(a)));
	});

	/**
	 * Every conversation the sidebar shows, top to bottom (what Alt+↑ / Alt+↓ walks through), each once: a favourite
	 * direct message shows in two sections but is one stop.
	 */
	private readonly visibleOrder = computed(() => {
		if (this.query()) return this.matches();
		const seen = new Set<string>();
		return this.sections()
			.flatMap((section) => this.shown(section))
			.filter((conversation) => {
				const id = String(conversation.id);
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			});
	});

	protected unread = isUnread;

	protected isCollapsed(key: string): boolean {
		return this.collapsed().has(key);
	}

	protected toggle(key: string): void {
		const next = new Set(this.collapsed());
		if (next.has(key)) next.delete(key);
		else next.add(key);
		this.collapsed.set(next);
		writeCollapsed(next);
	}

	/** A section's rows: all of them, or none while it is collapsed (its header counts the unread ones instead). */
	protected shown(section: ChatListSection): IChatConversationWithState[] {
		return this.isCollapsed(section.key) ? [] : section.conversations;
	}

	/** The unread conversations of a section, which its header shows while the section is collapsed. */
	protected unreadIn(section: ChatListSection): number {
		return section.conversations.filter(isUnread).length;
	}

	protected title(conversation: IChatConversationWithState): string {
		return conversationTitle(conversation, this.people().byEmployee, this.meEmployeeId(), this.untitled());
	}

	/**
	 * The title a row shows: a channel's without its `#` (the row draws the `#` or lock icon itself), a group's people
	 * by first name (more of them fit; the row's tooltip has the full names).
	 */
	protected rowTitle(conversation: IChatConversationWithState): string {
		if (conversation.kind === ChatConversationKindEnum.GROUP) {
			return groupShortTitle(conversation, this.people().byEmployee, this.meEmployeeId()) ?? this.title(conversation);
		}
		const title = this.title(conversation);
		return conversation.kind === ChatConversationKindEnum.CHANNEL ? title.replace(/^#/, '') : title;
	}

	/** How many people a direct or group conversation holds besides me (a group row shows it). */
	protected othersOf(conversation: IChatConversationWithState): number {
		// `members` is a summary of the first few (a group holds up to 50): the count is the whole one, less me.
		if (typeof conversation.memberCount === 'number' && conversation.memberCount > 0) return conversation.memberCount - 1;
		return otherMemberCount(conversation, this.meEmployeeId());
	}

	protected personOf(conversation: IChatConversationWithState): ChatPerson | null {
		return conversationPerson(conversation, this.people().byEmployee, this.meEmployeeId());
	}

	protected link(id: string): string {
		return `${CHAT_LINK}/${encodeURIComponent(id)}`;
	}

	protected asInput(event: Event): HTMLInputElement {
		return event.target as HTMLInputElement;
	}

	protected clearSearch(): void {
		this.query.set('');
	}

	protected onSearchKey(event: KeyboardEvent): void {
		// The Enter that confirms an IME composition (Japanese, Chinese, Korean input) is not a jump.
		if (event.isComposing || event.keyCode === 229) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			if (this.query()) this.clearSearch();
			else this.search()?.nativeElement.blur();
			return;
		}
		if (event.key === 'Enter') {
			const first = this.matches()[0];
			if (!first) return;
			event.preventDefault();
			this.clearSearch();
			this.search()?.nativeElement.blur();
			void this.router.navigateByUrl(this.link(String(first.id)));
		}
	}

	/**
	 * Ctrl/⌘+K focuses the filter; Alt+↑ / Alt+↓ opens the previous / next conversation of the sidebar. A key another
	 * handler already took (a text box, a menu) is left alone.
	 */
	protected onDocumentKey(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			const input = this.search()?.nativeElement;
			input?.focus();
			input?.select();
			return;
		}
		if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			// In a text box Alt+↑/↓ moves the caret (and leaving would drop a draft): only the "Jump to" box keeps the shortcut.
			if (isEditable(event.target) && event.target !== this.search()?.nativeElement) return;
			const order = this.visibleOrder();
			if (order.length === 0) return;
			event.preventDefault();
			const at = order.findIndex((conversation) => conversation.id === this.activeId());
			const step = event.key === 'ArrowUp' ? -1 : 1;
			const next = at < 0 ? (step > 0 ? 0 : order.length - 1) : (at + step + order.length) % order.length;
			void this.router.navigateByUrl(this.link(String(order[next].id)));
		}
	}
}
