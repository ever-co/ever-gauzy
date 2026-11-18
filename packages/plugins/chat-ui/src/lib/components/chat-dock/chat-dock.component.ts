import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, LOCALE_ID, type Signal, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge, Observable, of, Subscription } from 'rxjs';
import { auditTime, catchError, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, ChatVisibilityEnum, IChatConversationWithState, IChatMessageWithRelations, IOrganization, IUser, PermissionsEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_DOCK_PAGE_SIZE, CHAT_DOCK_TEAM_FACES, CHAT_LINK, CHAT_LIVE_AUDIT_MS, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { canManageConversation } from '../../chat-categories';
import { facesOf, peopleOf } from '../../chat-member-preview';
import { teamChannelOf } from '../../chat-team-suggestions';
import { withTaskReference } from '../../chat-tasks';
import { apiErrorMessage, ChatMemberIds, ChatPerson, continuesGroup, isSameDay, memberEmployeeIds, mergeMessages, newNonce, showNewestPage, userName } from '../../chat-ui.helpers';
import { ChatCreateTaskFlow } from '../../dialogs/chat-task-dialogs.component';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatFilesStore } from '../../services/chat-files.store';
import { coalesceReads } from '../../services/chat-live';
import { ChatLiveService, isTabVisible } from '../../services/chat-live.service';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../../services/chat-people.service';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatMessagePatch, ChatTeamDetails, ChatUiService } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from '../message-composer/message-composer.component';
import { MessageAction, MessageItemComponent } from '../message-item/message-item.component';
import { PersonAvatarComponent } from '../person-avatar/person-avatar.component';

/** What the card is open with: a person (our direct conversation) or a team (its channel). */
type DockTarget = { kind: 'person'; key: string; employeeId: string } | { kind: 'team'; key: string; team: ChatTeamDetails };

/** The card's header: who or which team it is. `memberCount` is null for a person. */
interface DockHeader {
	avatar: ChatPerson;
	name: string;
	position: string | null;
	memberCount: number | null;
}

/** A message of the card with its day divider and whether it continues the previous author's group, as in the chat. */
interface DockRow {
	message: IChatMessageWithRelations;
	day: string | null;
	continued: boolean;
}

/**
 * The docked message card (`ChatDockService`): a small card at the bottom right of the screen to write one person
 * directly, or a team in its channel (the channel named as the team: joined on opening, created with the first
 * message when there is none). A box to write and a way to the full conversation, as a quick-message card; above them, who it is and,
 * once there is something to read, the latest messages of our conversation, shown as the chat shows them. The
 * conversation is found (or created) when the card opens; its newest page is read again as its chat events come (or
 * on the chat's poll where they do not stream), so a message written, edited or deleted elsewhere shows, and it is
 * marked read up to the last message on screen.
 */
@Component({
	selector: 'ngx-chat-dock',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbIconModule, TranslatePipe, PersonAvatarComponent, MessageComposerComponent, MessageItemComponent],
	template: `
		@if (header(); as who) {
			<section class="panel" role="dialog" [attr.aria-label]="who.name" data-test="chat-dock" (keydown.escape)="onEscape($event)">
				<header class="head">
					<!-- A team has no presence of its own: its picture (or initials) goes without the dot. -->
					<ngx-chat-person-avatar [person]="who.avatar" [round]="true" [presence]="who.memberCount === null"></ngx-chat-person-avatar>
					<div class="identity">
						<span class="name" [attr.title]="who.name">{{ who.name }}</span>
						@if (who.position) {
							<span class="position" [attr.title]="who.position">{{ who.position }}</span>
						} @else if (who.memberCount !== null) {
							<!-- The team's members at the top: a few faces, overlapping, before their count; a click lists them all. -->
							<button
								type="button"
								class="members-line"
								data-test="chat-dock-members"
								[attr.aria-expanded]="showMembers()"
								aria-controls="chat-dock-member-list"
								[attr.title]="'CHAT.PROFILE.TEAM_MEMBERS' | translate"
								(click)="toggleMembers()"
							>
								@if (teamFaces().length) {
									<span class="faces">
										@for (face of teamFaces(); track face.employeeId) {
											<ngx-chat-person-avatar
												[person]="face"
												size="small"
												[round]="true"
												[presence]="false"
												[attr.title]="face.name"
											></ngx-chat-person-avatar>
										}
										<!-- The members beyond the faces shown, as one more disc. -->
										@if ((who.memberCount ?? 0) > teamFaces().length) {
											<span class="faces-more" aria-hidden="true">+{{ (who.memberCount ?? 0) - teamFaces().length }}</span>
										}
									</span>
								}
								<span class="position">{{ 'CHAT.LIST.MEMBERS' | translate: { count: who.memberCount } }}</span>
								<nb-icon class="chevron" [icon]="showMembers() ? 'chevron-up-outline' : 'chevron-down-outline'" aria-hidden="true"></nb-icon>
							</button>
						}
					</div>
					<button type="button" class="icon-button" data-test="chat-dock-close" [attr.aria-label]="'CHAT.VIEW.CLOSE' | translate" (click)="close()">
						<nb-icon icon="close-outline" aria-hidden="true"></nb-icon>
					</button>
				</header>

				@if (showMembers()) {
					<!-- Every member of the team the chat knows: face (with presence), name and position. -->
					<ul class="member-list" id="chat-dock-member-list" data-test="chat-dock-member-list" [attr.aria-label]="'CHAT.PROFILE.TEAM_MEMBERS' | translate">
						@for (member of teamMembers(); track member.employeeId) {
							<li class="member">
								<ngx-chat-person-avatar [person]="member" size="small" [round]="true"></ngx-chat-person-avatar>
								<span class="member-text">
									<span class="member-name" [attr.title]="member.name">{{ member.name }}</span>
									@if (member.position) {
										<span class="member-position" [attr.title]="member.position">{{ member.position }}</span>
									}
								</span>
							</li>
						}
					</ul>
				}

				@if (failed()) {
					<p class="note">{{ 'CHAT.ERROR' | translate }}</p>
				} @else if (newChannelFor(); as team) {
					<p class="note" data-test="chat-dock-new-channel">{{ 'CHAT.PROFILE.TEAM_CHANNEL_NEW' | translate: { name: team.name } }}</p>
				} @else if (rows().length > 0) {
					<!--
						The messages as the conversation shows them (its own message component) with its toolbar: react, create a
						task, pin, edit, mark unread, delete here; a thread opens in the chat.
					-->
					<div #scroller class="messages" data-test="chat-dock-messages">
						@for (row of rows(); track row.message.id) {
							@if (row.day) {
								<div class="day-divider" role="separator"><span>{{ row.day }}</span></div>
							}
							<ngx-chat-message-item
								[message]="row.message"
								[people]="dockPeople()"
								[files]="files()"
								[tasks]="tasks()"
								[canCreateTask]="canCreateTask() && !readOnly()"
								[meEmployeeId]="me()?.employeeId || null"
								[meUserId]="me()?.userId ?? null"
								[continued]="row.continued"
								[canManage]="canManage()"
								[readOnly]="readOnly()"
								[highlighted]="row.message.id === editing()?.id"
								(action)="onAction(row.message, $event)"
							></ngx-chat-message-item>
						}
					</div>
				}

				<!-- The chat's own composer, as in the conversation: formatting, mentions, emoji, files, and its draft. -->
				<div class="write">
					<ngx-chat-message-composer
						data-test="chat-dock-composer"
						[people]="dockPeople()"
						[placeholder]="
							who.memberCount === null
								? ('CHAT.PROFILE.MESSAGE_PLACEHOLDER' | translate: { name: who.name })
								: ('CHAT.COMPOSER.PLACEHOLDER' | translate: { name: '#' + (conversation()?.name || who.name) })
						"
						[disabled]="sending() || (!conversation() && !newChannelFor()) || readOnly()"
						[memberIds]="memberIds()"
						[meEmployeeId]="me()?.employeeId || null"
						[editing]="editing() !== null"
						[initialBody]="editing()?.body ?? null"
						[keepsFiles]="!!editing()?.attachmentIds?.length"
						[draftKey]="draftKey()"
						[resetToken]="resetToken()"
						[canAttach]="canAttach()"
						(submitted)="send($event)"
						(typing)="onTyping()"
						(editCancelled)="editing.set(null)"
					></ngx-chat-message-composer>
				</div>

				<button type="button" class="open" data-test="chat-dock-open" [disabled]="!conversation()" (click)="openInChat()">
					<span>{{ 'CHAT.DIALOG.OPEN_DIRECT' | translate }}</span>
					<nb-icon icon="arrow-forward-outline" aria-hidden="true"></nb-icon>
				</button>
			</section>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			/*
			 * Three bands one above the other, split by hairlines: who it is, the latest messages (once there are any)
			 * with the box to write, and the way to the full conversation. Colours come from the theme's tokens only; the
			 * chat's shared components (messages, composer) keep their own defaults behind each --chat-* variable they read,
			 * for a theme that lacks one of these tokens.
			 */
			.panel {
				--dock-line: var(--gauzy-border-default-color);
				--dock-muted: var(--gauzy-text-color-2);
				--dock-hover: var(--gauzy-hover-tint);
				--dock-accent: var(--color-primary-default);
				/* The chat page's colours, for the messages and the composer it shares with the conversation. */
				--chat-bg: var(--gauzy-card-1, var(--card-background-color));
				--chat-raised: var(--gauzy-card-1, var(--card-background-color));
				--chat-border: var(--gauzy-border-default-color);
				--chat-border-strong: var(--border-basic-color-4);
				--chat-hover: var(--gauzy-hover-tint);
				--chat-active-tint: var(--gauzy-active-tint);
				--chat-elevated: var(--gauzy-sidebar-background-3);
				--chat-message-hover: var(--gauzy-sidebar-background-4);
				--chat-composer-bar: var(--gauzy-sidebar-background-4);
				--chat-reaction-bg: var(--gauzy-sidebar-background-3);
				--chat-code-bg: var(--gauzy-sidebar-background-3);
				--chat-text: var(--text-basic-color);
				--chat-text-soft: var(--text-hint-color);
				--chat-muted: var(--text-hint-color);
				--chat-accent: var(--color-primary-default);
				--chat-accent-soft: var(--color-primary-transparent-100);
				--chat-accent-soft-2: var(--color-primary-transparent-200);
				--chat-on-accent: var(--text-control-color);
				--chat-send: var(--color-primary-default);
				--chat-link: var(--text-primary-color);
				--chat-mention-chip-bg: var(--color-primary-transparent-200);
				--chat-mention-chip-text: var(--text-primary-color);
				--chat-danger: var(--color-danger-default);
				display: flex;
				flex-direction: column;
				/* The width of a docked chat window (room for the composer's emoji panel too). */
				width: 25rem;
				max-width: calc(100vw - 2rem);
				border: 1px solid var(--dock-line);
				/* A floating panel: the theme's radius, scaled as the chat page scales its panels. */
				border-radius: calc(var(--border-radius) * 2);
				background: var(--gauzy-card-1);
				box-shadow: 0 0.25rem 1.5rem rgba(0, 0, 0, 0.2);
				color: var(--gauzy-text-color-1, inherit);
			}
			.head {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				min-width: 0;
				padding: 0.75rem 0.75rem 0.75rem 1.25rem;
				border-bottom: 1px solid var(--dock-line);
			}
			.identity {
				flex: 1 1 auto;
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.name,
			.position {
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.name {
				font-size: 0.875rem;
				font-weight: 600;
				line-height: 1.25rem;
			}
			.position {
				color: var(--dock-muted);
				font-size: 0.75rem;
				line-height: 1rem;
			}
			/* A team's members under its name: a few faces, overlapping, then their count. */
			.members-line {
				display: inline-flex;
				align-items: center;
				align-self: flex-start;
				gap: 0.5rem;
				min-width: 0;
				margin-top: 0.25rem;
			}
			/*
			 * Round faces, each ringed in the card's colour so the one before it stays readable where they overlap: a
			 * quarter of a face under the next, its initials clear.
			 */
			.faces {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				padding-left: 2px;
			}
			.faces ngx-chat-person-avatar,
			.faces-more {
				border-radius: 50%;
				box-shadow: 0 0 0 2px var(--gauzy-card-1);
			}
			.faces > * + * {
				margin-left: -0.375rem;
			}
			.faces-more {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.5rem;
				height: 1.5rem;
				padding: 0 0.3125rem;
				box-sizing: border-box;
				border-radius: 999px;
				background: var(--gauzy-sidebar-background-3, var(--dock-hover));
				color: var(--gauzy-text-color-1, inherit);
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			/* The members row is a quiet button: no frame, the muted text, a tint on hover only. */
			.members-line {
				max-width: 100%;
				padding: 0.1875rem 0.5rem 0.1875rem 0.25rem;
				margin-left: -0.25rem;
				border: 0;
				border-radius: calc(var(--border-radius) * 1.25);
				background: transparent;
				color: inherit;
				font: inherit;
				text-align: left;
				cursor: pointer;
				transition: background-color 0.1s ease;
			}
			.members-line:hover,
			.members-line:focus-visible {
				background: var(--dock-hover);
			}
			.members-line:focus-visible {
				outline: 2px solid var(--dock-accent);
				outline-offset: -2px;
			}
			.chevron {
				flex: 0 0 auto;
				font-size: 0.875rem;
				color: var(--dock-muted);
			}
			/* The team's member list, under the header: one row per member, scrolling past a few. */
			.member-list {
				max-height: 12rem;
				margin: 0;
				padding: 0.375rem 0;
				overflow-y: auto;
				list-style: none;
				border-bottom: 1px solid var(--dock-line);
			}
			.member {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				min-width: 0;
				padding: 0.375rem 1.25rem;
			}
			.member-text {
				display: flex;
				flex-direction: column;
				min-width: 0;
			}
			.member-name,
			.member-position {
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.member-name {
				font-size: 0.8125rem;
				line-height: 1.125rem;
			}
			.member-position {
				color: var(--dock-muted);
				font-size: 0.75rem;
				line-height: 1rem;
			}
			.icon-button {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 1.75rem;
				height: 1.75rem;
				padding: 0;
				border: 0;
				border-radius: calc(var(--border-radius) * 1.25);
				background: transparent;
				color: var(--dock-muted);
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.icon-button nb-icon {
				font-size: 1.125rem;
			}
			.icon-button:hover,
			.icon-button:focus-visible {
				background: var(--dock-hover);
				color: var(--gauzy-text-color-1, inherit);
			}
			/* The way to the full conversation: a quiet row along the bottom, its words at the start, the arrow at the end. */
			.open {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				width: 100%;
				padding: 0.625rem 1.25rem;
				border: 0;
				border-top: 1px solid var(--dock-line);
				/* The card does not clip (the composer's lists open above it): the row rounds its own corners, as the card's. */
				border-radius: 0 0 calc(var(--border-radius) * 2) calc(var(--border-radius) * 2);
				background: transparent;
				color: var(--dock-muted);
				font: inherit;
				font-size: 0.8125rem;
				line-height: 1.25rem;
				text-align: left;
				cursor: pointer;
				transition: background-color 0.1s ease, color 0.1s ease;
			}
			.open nb-icon {
				font-size: 1rem;
			}
			.open:hover:not(:disabled),
			.open:focus-visible {
				background: var(--dock-hover);
				color: var(--gauzy-text-color-1, inherit);
			}
			.open:focus-visible,
			.icon-button:focus-visible {
				outline: 2px solid var(--dock-accent);
				outline-offset: -2px;
			}
			.open:disabled {
				cursor: default;
				opacity: 0.5;
			}
			/*
			 * The latest messages, drawn by the conversation's own message component (it brings its own side padding,
			 * which the card's other bands match). The newest stays in sight.
			 */
			.messages {
				position: relative;
				/* Room for a picture; the header, the composer and the footer stay in the window. */
				max-height: min(20rem, calc(100vh - 20rem));
				padding: 0 0 0.5rem;
				overflow-y: auto;
				overflow-x: hidden;
			}
			/* The day a group of messages was sent: a rule with a pill that sticks to the top, as in the chat. */
			.day-divider {
				position: sticky;
				top: 0.25rem;
				z-index: 2;
				display: flex;
				align-items: center;
				justify-content: center;
				margin: 1rem 0 0.25rem;
				pointer-events: none;
			}
			.day-divider:first-child {
				margin-top: 0.75rem;
			}
			.day-divider::before {
				content: '';
				position: absolute;
				left: 0;
				right: 0;
				top: 50%;
				border-top: 1px solid var(--chat-border);
				z-index: -1;
			}
			/* A pill, as the chat page draws its day dividers. */
			.day-divider span {
				padding: 0.1875rem 0.875rem;
				border: 1px solid var(--chat-border);
				border-radius: 999px;
				background: var(--chat-bg);
				color: var(--chat-text);
				font-size: 0.6875rem;
				font-weight: 700;
				box-shadow: 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.06);
			}
			.note {
				margin: 0;
				padding: 0.75rem 1.25rem 0;
				color: var(--dock-muted);
				font-size: 0.8125rem;
				line-height: 1.25rem;
			}
			/* The composer's hint line under its frame gives the bottom its room. */
			.write {
				padding: 0.75rem 1.25rem 0.25rem;
			}
		`
	]
})
export class ChatDockComponent {
	private readonly api = inject(ChatUiService);
	private readonly live = inject(ChatLiveService);
	private readonly dock = inject(ChatDockService);
	private readonly router = inject(Router);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	private readonly store = inject(Store);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly filesStore = inject(ChatFilesStore);
	private readonly taskStore = inject(ChatTasksService);
	private readonly createTaskFlow = inject(ChatCreateTaskFlow);
	private readonly translate = inject(TranslateService);
	private readonly locale = inject(LOCALE_ID);

	/** The conversation's files read so far, for the pictures and files of the messages shown. */
	protected readonly files = this.filesStore.byDocument;

	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
	private readonly composer = viewChild(MessageComposerComponent);

	protected readonly person = this.dock.person;
	protected readonly team = this.dock.team;

	/** What the card is open with; the same person or team again (a fresh object) is no change. */
	private readonly target = computed<DockTarget | null>(
		() => {
			const person = this.person();
			if (person?.employeeId) return { kind: 'person', key: `person:${person.employeeId}`, employeeId: person.employeeId };
			const team = this.team();
			if (team?.id) return { kind: 'team', key: `team:${team.id}`, team };
			return null;
		},
		{ equal: (a, b) => a?.key === b?.key }
	);

	/** The card's header, for a person or for a team (its picture, or its initials, as an avatar). */
	protected readonly header = computed<DockHeader | null>(() => {
		const person = this.person();
		if (person) return { avatar: person, name: person.name, position: person.position ?? null, memberCount: null };
		const team = this.team();
		if (!team) return null;
		return {
			avatar: { employeeId: '', userId: null, name: team.name, imageUrl: team.imageUrl },
			name: team.name,
			position: null,
			memberCount: team.memberEmployeeIds.length
		};
	});

	/** Me, as my own messages show me: my name and picture. */
	protected readonly me = toSignal(
		(this.store.user$ as Observable<IUser | null | undefined>).pipe(
			map((user): ChatPerson | null =>
				user?.id
					? {
							employeeId: String(user.employee?.id ?? user.employeeId ?? ''),
							userId: String(user.id),
							name: userName(user),
							imageUrl: user.imageUrl ?? null
						}
					: null
			),
			distinctUntilChanged((a, b) => a?.userId === b?.userId && a?.name === b?.name && a?.imageUrl === b?.imageUrl)
		),
		{ initialValue: null }
	);

	protected readonly conversation = signal<IChatConversationWithState | null>(null);
	/**
	 * The team the card is open with while it has no channel yet: the box can be written in, and the first message
	 * sent creates the channel (named as the team, with its members) and goes to it.
	 */
	protected readonly newChannelFor = signal<ChatTeamDetails | null>(null);
	private readonly messages = signal<readonly IChatMessageWithRelations[]>([]);
	protected readonly failed = signal(false);
	protected readonly sending = signal(false);
	/** Bumped after a send: the composer clears. */
	protected readonly resetToken = signal(0);
	/** The message of mine being edited in the composer, if any. */
	protected readonly editing = signal<IChatMessageWithRelations | null>(null);

	private readonly organization = toSignal(this.store.selectedOrganization$ as Observable<IOrganization | null | undefined>, { initialValue: null });
	/** The organization's people, for the composer's `@` suggestions and mention names. */
	protected readonly people = toSignal(
		toObservable(this.organization).pipe(
			switchMap((organization) =>
				organization?.id && organization.tenantId ? this.peopleService.people(organization.id, organization.tenantId).pipe(catchError(() => of(EMPTY_PEOPLE))) : of(EMPTY_PEOPLE)
			)
		),
		{ initialValue: EMPTY_PEOPLE }
	);
	/** Files are stored as documents: attaching them needs `DOCS_CREATE`, as in the chat. */
	protected readonly canAttach = this.permission(PermissionsEnum.DOCS_CREATE);
	/** A task is created from a message with `ORG_TASK_ADD` (the API checks it too). */
	protected readonly canCreateTask = this.permission(PermissionsEnum.ORG_TASK_ADD);
	private readonly isAdmin = this.permission(PermissionsEnum.CHAT_MANAGE);
	/** Whether I manage the conversation (any message may then be deleted), as the chat decides it. */
	protected readonly canManage = computed(() => {
		const conversation = this.conversation();
		return !!conversation && canManageConversation(conversation, this.me()?.employeeId || null, this.isAdmin());
	});
	/** An archived conversation is read only, as in the chat (the card's conversation has me in it: found, joined or created). */
	protected readonly readOnly = computed(() => !!this.conversation()?.archivedAt);
	/** The conversation's members; before a team's channel exists, the team's members it will be created with. */
	protected readonly memberIds = computed<ChatMemberIds | null>(() => {
		const conversation = this.conversation();
		if (conversation) return memberEmployeeIds(conversation);
		const team = this.newChannelFor();
		return team ? { ids: new Set(team.memberEmployeeIds), complete: true } : null;
	});
	/** The conversation's own draft key: what is typed here is the draft the chat finds, and back. */
	protected readonly draftKey = computed(() => {
		const conversation = this.conversation();
		return conversation ? `conversation:${conversation.id}` : null;
	});

	/** The task summaries read so far, for the task cards of the messages shown. */
	protected readonly tasks = this.taskStore.summaries;

	/**
	 * The organization's people, with the person of the card and me added when they are not in it (yet): the authors'
	 * names and pictures show before the people load, and for someone who is not an employee.
	 */
	protected readonly dockPeople = computed<ChatPeople>(() => {
		const base = this.people();
		const extra = [this.person(), this.me()].filter((person): person is ChatPerson => !!person);
		const missing = extra.filter((person) => (person.employeeId && !base.byEmployee.has(person.employeeId)) || (person.userId && !base.byUser.has(person.userId)));
		if (!missing.length) return base;
		const byEmployee = new Map(base.byEmployee);
		const byUser = new Map(base.byUser);
		for (const person of missing) {
			if (person.employeeId && !byEmployee.has(person.employeeId)) byEmployee.set(person.employeeId, person);
			if (person.userId && !byUser.has(person.userId)) byUser.set(person.userId, person);
		}
		return { byEmployee, byUser, list: base.list };
	});

	/** A few of the team's members, as faces at the top of the card (the people the chat knows). */
	protected readonly teamFaces = computed<ChatPerson[]>(() => {
		const team = this.team();
		return team ? facesOf(team.memberEmployeeIds, this.dockPeople().byEmployee, CHAT_DOCK_TEAM_FACES) : [];
	});

	/** Whether the team's member list is open under the header. */
	protected readonly showMembers = signal(false);
	/** Every member of the team the chat knows, by name, for that list. */
	protected readonly teamMembers = computed<ChatPerson[]>(() => {
		const team = this.team();
		return team ? peopleOf(team.memberEmployeeIds, this.dockPeople().byEmployee) : [];
	});

	protected toggleMembers(): void {
		this.showMembers.update((open) => !open);
	}

	/** The messages with their day dividers and whether each continues the previous author's group, as in the chat. */
	protected readonly rows = computed<DockRow[]>(() => {
		const messages = this.messages();
		const today = new Date();
		const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
		return messages.map((message, index) => {
			const previous = messages[index - 1];
			const at = new Date(message.createdAt as Date);
			const newDay = !previous || !isSameDay(previous.createdAt as Date, at);
			return {
				message,
				day: newDay ? this.dayLabel(at, today, yesterday) : null,
				continued: !newDay && continuesGroup(previous, message)
			};
		});
	});

	/** The day divider's label, as the conversation words it. */
	private dayLabel(at: Date, today: Date, yesterday: Date): string {
		if (isSameDay(at, today)) return this.translate.instant('CHAT.VIEW.TODAY');
		if (isSameDay(at, yesterday)) return this.translate.instant('CHAT.VIEW.YESTERDAY');
		return formatDate(at, at.getFullYear() === today.getFullYear() ? 'EEEE, MMMM d' : 'EEEE, MMMM d, y', this.locale);
	}

	/** The newest message on screen. */
	private readonly newestId = computed(() => {
		const messages = this.messages();
		return messages.length ? String(messages[messages.length - 1].id) : null;
	});

	/** Whether the list is scrolled to its end (it opens there). */
	private atBottom = true;

	private scrollToBottom(): void {
		const element = this.scroller()?.nativeElement;
		if (!element) return;
		element.scrollTop = element.scrollHeight;
		this.atBottom = true;
	}

	/** The newest message of the other person the conversation was already marked read for. */
	private readThrough: string | null = null;
	/** A catch-up asked for the task cards to be read again with the next page. */
	private tasksStale = false;
	/** The reads of the newest page started so far: each page comes with the number of its read. */
	private reads = 0;
	/**
	 * For each message known to exist since the card turned to this person, the number of the read it was known by: the
	 * read whose page held it, or the latest read started when my send of it landed. The pages are read one after
	 * another, so a read started later holds it while it exists: when its page does not, the message was deleted since
	 * (a plain message deleted leaves the list), even when it is newer than all of that page. A read already under way
	 * when it became known may not hold it yet.
	 */
	private known = new Map<string, number>();

	/** The request of the person the card shows; a change of person drops it. */
	private request: Subscription | null = null;
	private polling: Subscription | null = null;

	constructor() {
		// The card turns to whoever (or whichever team) it is opened with.
		effect(() => {
			const target = this.target();
			untracked(() => this.load(target));
		});
		// Once the conversation is found the composer can be written in: it gets the keyboard.
		effect(() => {
			if (!this.conversation() && !this.newChannelFor()) return;
			setTimeout(() => this.composer()?.focus());
		});
		// A new newest message is brought in sight; a refresh that changes nothing leaves the reader where they are.
		effect(() => {
			this.newestId();
			setTimeout(() => this.scrollToBottom());
		});
		// The files the messages carry are read through the conversation (members only), as the chat reads them.
		effect(() => {
			const conversation = this.conversation();
			const messages = this.messages().filter((message) => !message.deletedAt);
			if (!conversation) return;
			untracked(() => {
				this.filesStore.ensureFor(String(conversation.id), messages);
				this.taskStore.ensure(messages.flatMap((message) => (message.taskReferences ?? []).map((reference) => String(reference.taskId))));
			});
		});
		// A picture that loads after the list was scrolled grows it: a reader at the bottom stays at the bottom.
		effect((onCleanup) => {
			const element = this.scroller()?.nativeElement;
			if (!element) return;
			const onScroll = () => (this.atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 32);
			const onLoad = () => {
				if (this.atBottom) this.scrollToBottom();
			};
			element.addEventListener('scroll', onScroll, { passive: true });
			// `load` does not bubble: it is caught on its way down.
			element.addEventListener('load', onLoad, true);
			onCleanup(() => {
				element.removeEventListener('scroll', onScroll);
				element.removeEventListener('load', onLoad, true);
			});
		});
		this.destroyRef.onDestroy(() => {
			this.request?.unsubscribe();
			this.polling?.unsubscribe();
		});
	}

	/**
	 * Finds (or creates) our direct conversation, or finds the team's channel, and reads its latest messages, then keeps
	 * reading the newer ones. A team without its channel yet gets one with the first message sent (`newChannelFor`).
	 */
	private load(target: DockTarget | null): void {
		this.request?.unsubscribe();
		this.polling?.unsubscribe();
		this.conversation.set(null);
		this.newChannelFor.set(null);
		this.showMembers.set(false);
		this.messages.set([]);
		this.editing.set(null);
		this.failed.set(false);
		this.readThrough = null;
		this.tasksStale = false;
		this.known = new Map();
		if (!target) return;
		const conversation$ =
			target.kind === 'person' ? this.api.direct([target.employeeId]).pipe(map(({ conversation }) => conversation)) : this.teamChannel(target.team);
		this.request = conversation$.subscribe({
			next: (conversation) => {
				if (conversation) this.start(conversation);
				else if (target.kind === 'team') this.newChannelFor.set(target.team);
			},
			error: () => this.failed.set(true)
		});
	}

	/** Shows this conversation: reads its latest messages, then keeps reading the newer ones. */
	private start(conversation: IChatConversationWithState): void {
		this.conversation.set(conversation);
		this.request = this.readNewest(String(conversation.id)).subscribe({
			next: (page) => {
				this.accept(page.messages, page.read);
				this.poll(conversation);
			},
			// The card says so, and the poll keeps trying: the first page it reads takes the note away.
			error: () => {
				this.failed.set(true);
				this.poll(conversation);
			}
		});
	}

	/**
	 * The team's channel: the one of my conversations named as the team; else a public one of that name, which I join;
	 * else null — none is created on opening, only with the first message sent (`createAndSend`).
	 */
	private teamChannel(team: ChatTeamDetails): Observable<IChatConversationWithState | null> {
		return this.api.listMine().pipe(
			switchMap(({ conversations }) => {
				const mine = teamChannelOf(conversations ?? [], team.name);
				if (mine) return of(mine);
				return this.api.browse().pipe(
					// Without the public channels to look through, the first message creates the channel.
					catchError(() => of([] as IChatConversationWithState[])),
					switchMap((open) => {
						const found = teamChannelOf((open ?? []).filter((conversation) => !conversation.archivedAt), team.name);
						if (!found) return of(null);
						return this.api.join(found.id).pipe(
							map(({ conversation }) => conversation),
							// Joined: the chat's lists and badge learn of it.
							tap(() => this.api.notifyChanged())
						);
					})
				);
			})
		);
	}

	/**
	 * The first message to a team without its channel: creates the channel, named as the team, with its members —
	 * public for a public team, private for a private one — so it is listed in the chat, then sends the message to it.
	 */
	private createAndSend(team: ChatTeamDetails, submission: ComposerSubmission): void {
		this.sending.set(true);
		const me = this.me()?.employeeId || null;
		this.api
			.createChannel({
				name: team.name,
				visibility: team.public ? ChatVisibilityEnum.PUBLIC : ChatVisibilityEnum.PRIVATE,
				memberEmployeeIds: team.memberEmployeeIds.filter((employeeId) => employeeId !== me)
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ conversation }) => {
					this.sending.set(false);
					// Created: the chat's lists and badge learn of it.
					this.api.notifyChanged();
					// Only while the card still waits for this team's channel: else the message is not sent anywhere else.
					if (this.newChannelFor() !== team) return;
					this.newChannelFor.set(null);
					this.start(conversation);
					this.send(submission);
				},
				error: (error) => {
					this.sending.set(false);
					this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	/**
	 * Reads the newest page again while the tab is seen, as the conversation follows itself: on each chat event of
	 * this conversation (a few close together read once), when the stream resumes or the tab is shown again, and on
	 * the chat's poll ticks — every few seconds where events do not stream, a rare safety net where they do. A read
	 * under way is never cancelled by the next trigger: triggers that come meanwhile ask for one more read after it
	 * (which holds what they announced), so slow answers or a steady stream of events cannot keep the card from
	 * updating. The task cards are read again on a message's update and after a catch-up, never on a mere tick.
	 */
	private poll(conversation: IChatConversationWithState): void {
		const id = String(conversation.id);
		const hints$ = this.live.hints$.pipe(filter((hint) => hint.conversationId === id));
		const catchUp$ = this.live.catchUp$.pipe(tap(() => (this.tasksStale = true)));
		const polling = merge(this.live.ticks(CHAT_MESSAGES_POLL_MS), hints$.pipe(auditTime(CHAT_LIVE_AUDIT_MS)), catchUp$)
			.pipe(
				filter(() => isTabVisible()),
				coalesceReads(() => this.readNewest(id).pipe(catchError(() => EMPTY)))
			)
			.subscribe((page) => {
				this.failed.set(false);
				this.accept(page.messages, page.read);
				// After a catch-up, the tasks the messages show may have changed meanwhile too.
				if (this.tasksStale) {
					this.tasksStale = false;
					this.taskStore.refreshAll(this.messages());
				}
			});
		// A task changed from a card is told to the messages that show it: their cards read the task again.
		polling.add(
			hints$
				.pipe(filter((hint) => hint.name === CHAT_EVENT_NAMES.MESSAGE_UPDATED && !!hint.messageId && isTabVisible()))
				.subscribe((hint) => this.taskStore.refreshShownBy(this.messages(), String(hint.messageId)))
		);
		this.polling = polling;
	}

	/**
	 * Makes the card show the newest page (see `showNewestPage`: what it holds as it holds it, what it no longer holds
	 * gone, an unchanged message keeping its object so its view is not drawn again), then marks the conversation read
	 * up to the last message on screen when the other person wrote something new: never further, so what arrives
	 * meanwhile stays unread, and not while the tab is hidden, when nothing was seen. A message known before this read
	 * began that its page does not hold was deleted, and leaves even as the newest (see `known`); one sent here while the
	 * read was under way stays, even when the page is empty.
	 */
	private accept(page: readonly IChatMessageWithRelations[], read: number): void {
		const inPage = new Set(page.map((message) => String(message.id)));
		const current = this.messages();
		// Known before this read began and not in its page: it left the newest page (deleted, or older than it reaches).
		const left = (message: IChatMessageWithRelations) => {
			const since = this.known.get(String(message.id));
			return !inPage.has(String(message.id)) && since !== undefined && since < read;
		};
		const live = current.filter((message) => !left(message));
		const shown = live.length === current.length ? current : live;
		const next = showNewestPage(shown, page);
		// What this read may not hold yet (sent here while it was under way) stays, whatever its place in the page's
		// order (a message of theirs written at the same moment may sort after it), and an empty page keeps it too.
		const pending = shown.filter((message) => !inPage.has(String(message.id)) && !next.includes(message));
		const messages = pending.length ? mergeMessages(next, pending) : next;
		for (const id of inPage) if (!this.known.has(id)) this.known.set(id, read);
		this.messages.set(messages);
		const conversation = this.conversation();
		const me = this.me()?.userId ?? null;
		const last = messages[messages.length - 1];
		const theirs = [...messages].reverse().find((message) => String(message.authorUserId ?? '') !== me);
		if (!conversation || !last || !theirs || String(theirs.id) === this.readThrough) return;
		if (!isTabVisible()) return;
		const through = String(theirs.id);
		this.readThrough = through;
		this.api
			.read(conversation.id, last.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => this.api.notifyChanged(),
				// Not marked: the next page tries again.
				error: () => {
					if (this.readThrough === through) this.readThrough = null;
				}
			});
	}

	/** Reads the newest page, with the number of its read (see `known`). */
	private readNewest(conversationId: string): Observable<{ read: number; messages: readonly IChatMessageWithRelations[] }> {
		const read = (this.reads += 1);
		return this.api.messages(conversationId, { limit: CHAT_DOCK_PAGE_SIZE }).pipe(map((page) => ({ read, messages: page.messages })));
	}

	protected close(): void {
		this.dock.close();
	}

	/** Escape leaves edit mode, else closes the member list, else closes the card, unless the composer used it to close one of its own lists. */
	protected onEscape(event: Event): void {
		if (event.defaultPrevented) return;
		if (this.editing()) {
			this.editing.set(null);
			return;
		}
		if (this.showMembers()) {
			this.showMembers.set(false);
			return;
		}
		this.close();
	}

	/** Whether I have a permission, kept up to date with my role's permissions. */
	private permission(permission: PermissionsEnum): Signal<boolean> {
		return toSignal(
			(this.store.userRolePermissions$ as Observable<unknown>).pipe(
				map(() => this.store.hasPermission(permission)),
				distinctUntilChanged()
			),
			{ initialValue: this.store.hasPermission(permission) }
		);
	}

	protected onTyping(): void {
		const conversation = this.conversation();
		if (conversation) this.api.signalTyping(String(conversation.id));
	}

	/** The full conversation in the chat (with a message's thread open); the card gives way to it. */
	protected openInChat(threadRootId: string | null = null): void {
		const conversation = this.conversation();
		if (!conversation) return;
		this.dock.close();
		void this.router.navigate([CHAT_LINK, conversation.id], threadRootId ? { queryParams: { thread: threadRootId } } : {});
	}

	/** What a message's toolbar asks, done as the conversation does it; a thread has no room here and opens in the chat. */
	protected onAction(message: IChatMessageWithRelations, action: MessageAction): void {
		const conversation = this.conversation();
		if (!conversation) return;
		const id = String(conversation.id);
		switch (action.kind) {
			case 'reply':
				// A reply also sent to the conversation opens the thread it belongs to (a reply has no replies of its own).
				this.openInChat(String(message.threadRootId ?? message.id));
				return;
			case 'edit':
				this.editing.set(message);
				return;
			case 'delete':
				if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.MESSAGE.DELETE_CONFIRM'))) return;
				this.api
					.remove(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => {
							// Only the fields the deletion changed: what a refresh brought meanwhile stays.
							if (this.isCurrent(id)) this.replace({ id: message.id, body: '', deletedAt: new Date() });
							this.api.notifyChanged();
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'replaced':
				// An app's reply to a click on one of its buttons: the message as the reply left it.
				if (this.isCurrent(id)) this.replace(action.message);
				return;
			case 'pin':
				this.api
					.setPinned(message.id, action.pinned)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (result) => {
							if (this.isCurrent(id)) this.replace(result.message);
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'react':
				this.api
					.react(message.id, action.emoji, action.on)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: (result) => {
							if (this.isCurrent(id)) this.replace(result.message);
						},
						error: (error) => this.fail(error)
					});
				return;
			case 'unread':
				// The read mark stays where it is (`readThrough`): only a newer message of theirs marks it read again.
				this.api
					.unreadFrom(message.id)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => this.api.notifyChanged(),
						error: (error) => this.fail(error)
					});
				return;
			case 'createTask':
				this.openCreateTask(message);
				return;
			case 'follow':
				this.api
					.setFollowing(message.id, action.following)
					.pipe(takeUntilDestroyed(this.destroyRef))
					.subscribe({
						next: () => {
							// Only the field it changed: what a refresh brought meanwhile stays.
							if (this.isCurrent(id)) this.replace({ id: message.id, following: action.following });
						},
						error: (error) => this.fail(error)
					});
				return;
			default:
				return;
		}
	}

	/** "Create task from message": the dialog, then the message shows the task's card. */
	private openCreateTask(message: IChatMessageWithRelations): void {
		const conversation = this.conversation();
		if (!conversation) return;
		const id = String(conversation.id);
		const organization = this.organization();
		this.createTaskFlow
			.open({
				message,
				people: this.dockPeople(),
				conversationNames: new Map(),
				organizationId: organization?.id ? String(organization.id) : conversation.organizationId ? String(conversation.organizationId) : null,
				tenantId: organization?.tenantId ? String(organization.tenantId) : null
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((reference) => {
				if (!reference || !this.isCurrent(id)) return;
				// Added to the message as shown now (another reference may have come meanwhile).
				const current = this.messages().find((item) => item.id === message.id) ?? message;
				this.replace({ id: message.id, taskReferences: withTaskReference(current, reference).taskReferences });
			});
	}

	/** Whether the card still shows the conversation a request was made for. */
	private isCurrent(id: string): boolean {
		return String(this.conversation()?.id) === id;
	}

	/** Puts the API's version of a message (or the fields of it that changed) in place of ours. */
	private replace(patch: ChatMessagePatch): void {
		this.messages.set(this.messages().map((item) => (item.id === patch.id ? { ...item, ...patch } : item)));
	}

	private fail(error: unknown, fallbackKey = 'CHAT.DIALOG.FAILED'): void {
		this.toastr.danger(apiErrorMessage(error) ?? this.translate.instant(fallbackKey));
	}

	protected send(submission: ComposerSubmission): void {
		if (this.sending()) return;
		const conversation = this.conversation();
		if (!conversation) {
			// A team without its channel yet: the first message creates it.
			const team = this.newChannelFor();
			if (team && !this.editing()) this.createAndSend(team, submission);
			return;
		}
		const editing = this.editing();
		if (editing) {
			this.saveEdit(String(conversation.id), editing, submission);
			return;
		}
		this.sending.set(true);
		this.api
			.send(conversation.id, {
				body: submission.body,
				nonce: newNonce(),
				mentionEmployeeIds: submission.mentionEmployeeIds,
				...(submission.attachmentIds.length ? { attachmentIds: submission.attachmentIds } : {})
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.sending.set(false);
					this.api.notifyChanged();
					// Only when the card still shows the conversation the message went to; otherwise the draft it came
					// from is not to be sent again.
					if (String(this.conversation()?.id) !== String(conversation.id)) {
						clearDraft(`conversation:${conversation.id}`);
						return;
					}
					// Known from the latest read started: that read may not hold it yet, the next one does while it exists.
					if (!this.known.has(String(result.message.id))) this.known.set(String(result.message.id), this.reads);
					this.messages.set(mergeMessages(this.messages(), [result.message]));
					this.resetToken.update((value) => value + 1);
					// The box was disabled while sending: the keyboard goes back to it.
					setTimeout(() => this.composer()?.focus());
				},
				error: () => {
					this.sending.set(false);
					this.toastr.danger('CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}

	/**
	 * Saves the message being edited. Once it is saved the composer leaves edit mode and clears, but only for that edit:
	 * another message picked for editing while it saved keeps its edit session.
	 */
	private saveEdit(id: string, message: IChatMessageWithRelations, submission: ComposerSubmission): void {
		this.sending.set(true);
		this.api
			.edit(message.id, { body: submission.body, mentionEmployeeIds: submission.mentionEmployeeIds })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result) => {
					this.sending.set(false);
					if (!this.isCurrent(id)) return;
					this.replace(result.message);
					if (String(this.editing()?.id) !== String(message.id)) return;
					this.editing.set(null);
					this.resetToken.update((value) => value + 1);
					setTimeout(() => this.composer()?.focus());
				},
				error: (error) => {
					this.sending.set(false);
					this.fail(error, 'CHAT.COMPOSER.SEND_FAILED');
				}
			});
	}
}
