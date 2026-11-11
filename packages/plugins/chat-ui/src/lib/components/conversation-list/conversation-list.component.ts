import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatConversationKindEnum, ChatVisibilityEnum, IChatCategory, IChatConversationWithState } from '@gauzy/contracts';
import { sortCategories } from '../../chat-categories';
import { CHAT_LINK, CHAT_THREADS_PATH, CHAT_UNREADS_PATH } from '../../chat-ui.constants';
import { conversationTitle, isUnread } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';

export type ChatListView = 'conversation' | 'unreads' | 'threads';

/** The left pane: Unreads and Threads, favourites, the channels by category, the direct messages, and the actions. */
@Component({
	selector: 'ngx-chat-conversation-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgTemplateOutlet, RouterLink, NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		<div class="list" data-test="chat-list">
			<div class="list-actions">
				<button nbButton ghost size="tiny" data-test="new-channel" [nbTooltip]="'CHAT.LIST.NEW_CHANNEL' | translate" (click)="newChannel.emit()">
					<nb-icon icon="plus-outline"></nb-icon> {{ 'CHAT.LIST.NEW_CHANNEL' | translate }}
				</button>
				<button nbButton ghost size="tiny" data-test="new-message" [nbTooltip]="'CHAT.LIST.NEW_MESSAGE' | translate" (click)="newDirect.emit()">
					<nb-icon icon="edit-2-outline"></nb-icon> {{ 'CHAT.LIST.NEW_MESSAGE' | translate }}
				</button>
			</div>

			<nav class="views">
				<a class="row view" [class.active]="view() === 'unreads'" [routerLink]="unreadsLink" data-test="view-unreads">
					<nb-icon icon="radio-button-on-outline"></nb-icon>
					<span class="title">{{ 'CHAT.LIST.UNREADS' | translate }}</span>
					@if (unreadCount() > 0) {
						<span class="count">{{ unreadCount() }}</span>
					}
				</a>
				<a class="row view" [class.active]="view() === 'threads'" [routerLink]="threadsLink" data-test="view-threads">
					<nb-icon icon="message-square-outline"></nb-icon>
					<span class="title">{{ 'CHAT.LIST.THREADS' | translate }}</span>
					@if (threadCount() > 0) {
						<span class="count">{{ threadCount() }}</span>
					}
				</a>
			</nav>

			@if (favorites().length > 0) {
				<h6 class="section">{{ 'CHAT.LIST.FAVORITES' | translate }}</h6>
				@for (conversation of favorites(); track conversation.id) {
					<ng-container *ngTemplateOutlet="row; context: { $implicit: conversation }"></ng-container>
				}
			}

			@for (group of channelGroups(); track group.key) {
				<h6 class="section">{{ group.name ?? ('CHAT.LIST.CHANNELS' | translate) }}</h6>
				@for (conversation of group.conversations; track conversation.id) {
					<ng-container *ngTemplateOutlet="row; context: { $implicit: conversation }"></ng-container>
				}
			}
			@if (channelCount() === 0) {
				<h6 class="section">{{ 'CHAT.LIST.CHANNELS' | translate }}</h6>
				<p class="empty">{{ 'CHAT.LIST.NO_CHANNELS' | translate }}</p>
			}
			<button nbButton ghost size="tiny" class="browse" data-test="browse-channels" (click)="browse.emit()">
				<nb-icon icon="search-outline"></nb-icon> {{ 'CHAT.LIST.BROWSE' | translate }}
			</button>
			@if (canManageCategories()) {
				<button nbButton ghost size="tiny" class="browse" data-test="manage-categories" (click)="manageCategories.emit()">
					<nb-icon icon="folder-outline"></nb-icon> {{ 'CHAT.CATEGORIES.TITLE' | translate }}
				</button>
			}

			<h6 class="section">{{ 'CHAT.LIST.DIRECT' | translate }}</h6>
			@for (conversation of direct(); track conversation.id) {
				<ng-container *ngTemplateOutlet="row; context: { $implicit: conversation }"></ng-container>
			} @empty {
				<p class="empty">{{ 'CHAT.LIST.NO_DIRECT' | translate }}</p>
			}
		</div>

		<ng-template #row let-conversation>
			<a
				class="row"
				[class.active]="conversation.id === activeId()"
				[class.unread]="unread(conversation)"
				[routerLink]="link(conversation.id)"
				[attr.data-test]="'conversation-' + conversation.id"
			>
				@if (conversation.kind === 'channel') {
					<nb-icon [icon]="conversation.visibility === 'private' ? 'lock-outline' : 'hash-outline'"></nb-icon>
				} @else {
					<nb-icon [icon]="conversation.kind === 'group' ? 'people-outline' : 'person-outline'"></nb-icon>
				}
				<span class="title">{{ title(conversation) }}</span>
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
			.list {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				padding: 0.5rem;
				overflow-y: auto;
				height: 100%;
			}
			.list-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem;
				margin-bottom: 0.5rem;
			}
			.views {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				margin-bottom: 0.5rem;
			}
			.section {
				margin: 0.75rem 0 0.25rem;
				padding: 0 0.5rem;
				font-size: 0.6875rem;
				text-transform: uppercase;
				letter-spacing: 0.04em;
				opacity: 0.65;
			}
			.row {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.375rem 0.5rem;
				border-radius: 0.375rem;
				color: inherit;
				text-decoration: none;
				font-size: 0.875rem;
			}
			.row:hover {
				background: rgba(127, 127, 127, 0.12);
			}
			.row.active {
				background: rgba(127, 127, 127, 0.2);
				font-weight: 600;
			}
			.row.unread .title {
				font-weight: 700;
			}
			.row nb-icon {
				font-size: 1rem;
				opacity: 0.7;
				flex: 0 0 auto;
			}
			.title {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.count {
				flex: 0 0 auto;
				min-width: 1.25rem;
				padding: 0 0.375rem;
				border-radius: 999px;
				background: rgba(127, 127, 127, 0.25);
				font-size: 0.6875rem;
				font-weight: 700;
				text-align: center;
			}
			.count.mention {
				background: var(--color-danger-default, #e4493f);
				color: var(--text-control-color, #fff);
			}
			.empty {
				margin: 0;
				padding: 0.25rem 0.5rem;
				font-size: 0.8125rem;
				opacity: 0.65;
			}
			.browse {
				align-self: flex-start;
				margin-top: 0.25rem;
			}
		`
	]
})
export class ConversationListComponent {
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

	protected readonly unreadsLink = `${CHAT_LINK}/${CHAT_UNREADS_PATH}`;
	protected readonly threadsLink = `${CHAT_LINK}/${CHAT_THREADS_PATH}`;

	protected readonly unreadCount = computed(() => this.conversations().filter(isUnread).length);
	protected readonly favorites = computed(() => this.conversations().filter((conversation) => conversation.state?.isFavorite));
	protected readonly channels = computed(() =>
		this.conversations().filter((conversation) => conversation.kind === ChatConversationKindEnum.CHANNEL && !conversation.state?.isFavorite)
	);
	protected readonly channelCount = computed(() => this.channels().length);
	protected readonly direct = computed(() =>
		this.conversations().filter((conversation) => conversation.kind !== ChatConversationKindEnum.CHANNEL && !conversation.state?.isFavorite)
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

	protected readonly isPrivate = ChatVisibilityEnum.PRIVATE;

	protected unread = isUnread;

	protected title(conversation: IChatConversationWithState): string {
		return conversationTitle(conversation, this.people().byEmployee, this.meEmployeeId(), this.untitled());
	}

	protected link(id: string): string {
		return `${CHAT_LINK}/${encodeURIComponent(id)}`;
	}
}
