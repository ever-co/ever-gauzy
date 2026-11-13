import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogRef,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import {
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatVisibilityEnum,
	CHAT_GROUP_MAX_MEMBERS,
	IChatCategory,
	IChatConversationUpdateInput,
	IChatConversationWithState,
	IChatMemberSummary,
	IChatWebhook
} from '@gauzy/contracts';
import { movedCategoryOrder, nextCategoryPosition, sortCategories } from '../chat-categories';
import { apiErrorMessage, ChatPerson } from '../chat-ui.helpers';
import { ChatPeople, EMPTY_PEOPLE } from '../services/chat-people.service';
import { ChatUiService } from '../services/chat-ui.service';
import { PersonAvatarComponent } from '../components/person-avatar/person-avatar.component';
import { ChatWebhooksService } from '../services/chat-webhooks.service';
import { ChatWebhooksPanelComponent } from './chat-webhooks-panel.component';

const SETTINGS_DIALOG_STYLES = `
		.dialog {
			width: min(36rem, 94vw);
			max-height: 88vh;
		}
		.field {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin-bottom: 0.75rem;
			font-size: 0.8125rem;
		}
		.section {
			margin: 1rem 0 0.375rem;
			font-size: 0.75rem;
			text-transform: uppercase;
			opacity: 0.7;
		}
		.rows {
			margin: 0;
			padding: 0;
			list-style: none;
			max-height: 32vh;
			overflow-y: auto;
		}
		.row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0.25rem;
			font-size: 0.875rem;
		}
		.row .grow {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.role {
			font-size: 0.6875rem;
			opacity: 0.7;
		}
		.add {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			margin-top: 0.5rem;
		}
		.add > :first-child {
			flex: 1 1 auto;
		}
		.note {
			margin: 0.25rem 0;
			font-size: 0.8125rem;
			opacity: 0.7;
		}
		.error {
			margin: 0.5rem 0 0;
			color: var(--color-danger-default);
			font-size: 0.8125rem;
		}
		.footer {
			display: flex;
			justify-content: flex-end;
			gap: 0.5rem;
		}
		.loading {
			min-height: 3rem;
		}
		.tabs {
			display: flex;
			gap: 0.25rem;
			margin-bottom: 0.75rem;
			border-bottom: 1px solid rgba(127, 127, 127, 0.25);
		}
		.tab {
			padding: 0.375rem 0.75rem;
			border: 0;
			border-bottom: 2px solid transparent;
			background: transparent;
			color: inherit;
			font-size: 0.8125rem;
			cursor: pointer;
		}
		.tab.active {
			border-bottom-color: var(--color-primary-default, #3366ff);
			font-weight: 600;
		}
	`;

/** The conversation settings' own look: a details panel with a header, tabs, and one fixed-height body. */
const CHANNEL_SETTINGS_STYLES = `
		.channel-dialog {
			width: min(38rem, 94vw);
			max-height: 90vh;
			margin: 0;
		}
		.head {
			padding: 1rem 1.25rem 0;
		}
		.head-line {
			display: flex;
			align-items: center;
			gap: 0.625rem;
			min-width: 0;
		}
		.head-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			flex: 0 0 auto;
			border-radius: var(--border-radius);
			background: var(--gauzy-sidebar-background-3);
		}
		.head-icon nb-icon {
			font-size: 1.125rem;
		}
		.head-text {
			display: flex;
			flex-direction: column;
			flex: 1 1 auto;
			min-width: 0;
		}
		.head-title {
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 1.0625rem;
			font-weight: 700;
			line-height: 1.3;
		}
		.head-topic {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 0.8125rem;
			opacity: 0.65;
		}
		.head-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			flex: 0 0 auto;
			padding: 0;
			border: 0;
			border-radius: var(--border-radius);
			background: transparent;
			color: inherit;
			opacity: 0.7;
			cursor: pointer;
		}
		.head-close:hover,
		.head-close:focus-visible {
			background: var(--gauzy-hover-tint);
			opacity: 1;
		}
		.head-close nb-icon {
			font-size: 1.25rem;
		}
		.channel-dialog .tabs {
			margin: 0.75rem 0 0;
			border-bottom: 0;
			gap: 1.25rem;
		}
		.channel-dialog .tab {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.5rem 0 0.625rem;
			font-size: 0.875rem;
			font-weight: 600;
			opacity: 0.65;
		}
		.channel-dialog .tab:hover {
			opacity: 1;
		}
		.channel-dialog .tab.active {
			opacity: 1;
		}
		.tab-count {
			font-size: 0.75rem;
			font-weight: 600;
			opacity: 0.7;
		}
		.body {
			height: min(28rem, 62vh);
			padding: 1.25rem;
			overflow-y: auto;
		}
		.panel {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
		.channel-dialog .field {
			gap: 0.375rem;
			margin: 0;
		}
		.label {
			font-size: 0.8125rem;
			font-weight: 600;
		}
		.label-line {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
		}
		.counter {
			font-size: 0.75rem;
			opacity: 0.55;
			font-variant-numeric: tabular-nums;
		}
		.hint {
			font-size: 0.75rem;
			line-height: 1.4;
			opacity: 0.65;
		}
		.hint.invalid {
			color: var(--color-danger-default);
			opacity: 1;
		}
		.affix {
			position: relative;
			display: block;
		}
		.affix-mark {
			position: absolute;
			top: 50%;
			left: 0.875rem;
			transform: translateY(-50%);
			font-weight: 600;
			opacity: 0.55;
			pointer-events: none;
		}
		.affix input {
			padding-left: 1.75rem;
		}
		.option {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem 0.875rem;
			border: 1px solid var(--gauzy-border-default-color);
			border-radius: var(--border-radius);
		}
		.option.disabled {
			opacity: 0.75;
		}
		.option-icon {
			display: inline-flex;
			flex: 0 0 auto;
			opacity: 0.75;
		}
		.option-icon nb-icon {
			font-size: 1.25rem;
		}
		.option-text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1 1 auto;
			min-width: 0;
		}
		.option-title {
			font-size: 0.875rem;
			font-weight: 600;
		}
		.read-only {
			display: flex;
			align-items: flex-start;
			gap: 0.5rem;
			margin: 0;
			padding: 0.625rem 0.75rem;
			border-radius: var(--border-radius);
			background: var(--gauzy-sidebar-background-3);
			font-size: 0.8125rem;
			line-height: 1.4;
		}
		.read-only nb-icon {
			flex: 0 0 auto;
			font-size: 1rem;
			margin-top: 0.0625rem;
			opacity: 0.7;
		}
		.search {
			position: relative;
		}
		.search nb-icon {
			position: absolute;
			top: 50%;
			left: 0.75rem;
			transform: translateY(-50%);
			font-size: 1rem;
			opacity: 0.55;
			pointer-events: none;
		}
		.search input {
			padding-left: 2.25rem;
		}
		.channel-dialog .add {
			margin: 0;
		}
		.member-list {
			margin: 0 -0.5rem;
			padding: 0;
			list-style: none;
		}
		.member {
			display: flex;
			align-items: center;
			gap: 0.625rem;
			padding: 0.3125rem 0.5rem;
			border-radius: calc(var(--border-radius) * 0.75);
		}
		.member:hover {
			background: var(--gauzy-hover-tint);
		}
		.member-text {
			display: flex;
			flex-direction: column;
			flex: 1 1 auto;
			min-width: 0;
			line-height: 1.25;
		}
		.member-name,
		.member-meta {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.member-name {
			font-size: 0.8125rem;
			font-weight: 600;
		}
		.member-meta {
			font-size: 0.6875rem;
			opacity: 0.6;
		}
		.muted {
			font-weight: 400;
			opacity: 0.6;
		}
		.remove {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 1.75rem;
			height: 1.75rem;
			flex: 0 0 auto;
			padding: 0;
			border: 0;
			border-radius: calc(var(--border-radius) * 0.75);
			background: transparent;
			color: inherit;
			opacity: 0;
			cursor: pointer;
		}
		.member:hover .remove,
		.remove:focus-visible {
			opacity: 0.7;
		}
		.remove:hover:not(:disabled) {
			background: var(--gauzy-sidebar-background-3);
			color: var(--color-danger-default);
			opacity: 1;
		}
		.remove:disabled {
			cursor: default;
		}
		@media (hover: none) {
			.remove {
				opacity: 0.7;
			}
		}
		.empty {
			padding: 1.5rem 0.5rem;
			text-align: center;
			font-size: 0.8125rem;
			opacity: 0.65;
		}
		.channel-dialog .footer {
			padding: 0.75rem 1.25rem;
		}
		.sr-only {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	`;

/** The tabs of the conversation settings. */
type SettingsTab = 'settings' | 'members' | 'integrations';

/** What the conversation passes to its settings. */
export interface ChannelSettingsContext {
	conversation: IChatConversationWithState;
	categories: readonly IChatCategory[];
	people: ChatPeople;
	meEmployeeId: string | null;
	/** Whether I manage the conversation (`CHAT_MANAGE`, its manager, or its creator): the fields can be changed. */
	canManage: boolean;
	/** Where the dialog opens: the fields (default), or the members (from the member count). */
	section?: 'settings' | 'members';
}

/** One member as the settings list it. */
interface MemberRow {
	employeeId: string;
	name: string;
	person: ChatPerson | null;
	role: ChatMemberRoleEnum;
	isMe: boolean;
	/** Their position in the organization (e.g. "Frontend Developer"), when one is set. */
	position: string | null;
}

/**
 * The settings of a conversation: for a channel its name, topic, public or private, and sidebar category; for a
 * direct or group conversation its topic; and its members, who a manager adds and removes (none of a direct
 * conversation or of the default channel, which every employee is in). Every member sees them; only a manager
 * changes them (`PATCH /chat/conversations/:id`, `POST` / `DELETE …/members`). Closes with the conversation as the
 * API answers it after the changes, or null when nothing changed.
 */
/** Counts the settings dialogs opened, for ids unique per dialog. */
let channelSettingsDialogs = 0;

@Component({
	selector: 'ngx-chat-channel-settings-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	// Escape closes through the dialog's own Close (the page opens it without Nebular's), which waits for a write.
	host: { '(document:keyup.escape)': 'closeOnEscape()' },
	imports: [
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		TranslatePipe,
		PersonAvatarComponent,
		ChatWebhooksPanelComponent
	],
	template: `
		<nb-card class="dialog channel-dialog" data-test="channel-settings-dialog">
			<nb-card-header class="head">
				<div class="head-line">
					<span class="head-icon"><nb-icon [icon]="headIcon()"></nb-icon></span>
					<div class="head-text">
						<h5 class="head-title" data-test="settings-title">{{ headTitle() || ('CHAT.SETTINGS.TITLE' | translate) }}</h5>
						@if (headTopic()) {
							<span class="head-topic" [attr.title]="headTopic()">{{ headTopic() }}</span>
						}
					</div>
					<button type="button" class="head-close" data-test="settings-close" [attr.aria-label]="'CHAT.DIALOG.CLOSE' | translate" (click)="close()">
						<nb-icon icon="close-outline"></nb-icon>
					</button>
				</div>
				<!-- Tabs as WAI-ARIA tabs: arrow keys, Home and End move between them; the active one is the tab stop. -->
				<div class="tabs" role="tablist" data-test="settings-tabs" (keydown)="tabKey($event)">
					@for (item of tabs(); track item) {
						<button
							type="button"
							role="tab"
							class="tab"
							[class.active]="tab() === item"
							[attr.id]="idBase + '-tab-' + item"
							[attr.aria-controls]="idBase + '-panel-' + item"
							[attr.aria-selected]="tab() === item"
							[attr.tabindex]="tab() === item ? 0 : -1"
							[attr.data-test]="'tab-' + item"
							(click)="tab.set(item)"
						>
							@switch (item) {
								@case ('settings') {
									{{ 'CHAT.SETTINGS.TAB_SETTINGS' | translate }}
								}
								@case ('members') {
									{{ 'CHAT.SETTINGS.TAB_MEMBERS' | translate }}
									@if (!loadingMembers()) {
										<span class="tab-count">{{ members().length }}</span>
									}
								}
								@default {
									{{ 'CHAT.SETTINGS.TAB_INTEGRATIONS' | translate }}
								}
							}
						</button>
					}
				</div>
			</nb-card-header>
			<nb-card-body class="body">
				<!-- Kept while another tab shows, so its list and a write under way (and the secret it makes) survive. -->
				@if (webhooks() !== null) {
					<ngx-chat-webhooks-panel
						role="tabpanel"
						[attr.id]="idBase + '-panel-integrations'"
						[attr.aria-labelledby]="idBase + '-tab-integrations'"
						[hidden]="tab() !== 'integrations'"
						[conversationId]="context.conversation.id"
						[people]="context.people"
						[initial]="webhooks()"
						(busyChange)="webhookWriting($event)"
						(secretsShown)="showWebhookSecrets()"
						(secretsDismissed)="secretOnScreen = false"
						(writeFailed)="showWebhookFailure()"
					></ngx-chat-webhooks-panel>
				} @else if (webhooksFailed()) {
					<!-- The list could not be read (not a 404, which means webhooks are off): the tab says so and offers a retry. -->
					<div
						role="tabpanel"
						[attr.id]="idBase + '-panel-integrations'"
						[attr.aria-labelledby]="idBase + '-tab-integrations'"
						[hidden]="tab() !== 'integrations'"
						data-test="webhooks-load-failed"
					>
						<p class="error" role="alert">{{ 'CHAT.WEBHOOKS.LOAD_FAILED' | translate }}</p>
						<button nbButton size="small" status="basic" type="button" data-test="webhooks-retry" (click)="loadWebhooks()">{{ 'CHAT.WEBHOOKS.RETRY' | translate }}</button>
					</div>
				}

				@if (tab() === 'settings') {
					<div class="panel" role="tabpanel" [attr.id]="idBase + '-panel-settings'" [attr.aria-labelledby]="idBase + '-tab-settings'">
						@if (!context.canManage) {
							<p class="read-only" data-test="settings-read-only">
								<nb-icon icon="info-outline"></nb-icon>
								<span>{{ 'CHAT.SETTINGS.READ_ONLY' | translate }}</span>
							</p>
						}
						@if (isChannel()) {
							<label class="field">
								<span class="label">{{ 'CHAT.DIALOG.CHANNEL_NAME' | translate }}</span>
								<span class="affix">
									<span class="affix-mark" aria-hidden="true">#</span>
									<input nbInput fullWidth data-test="settings-name" [disabled]="!context.canManage" [ngModel]="name()" (ngModelChange)="name.set($event)" maxlength="80" />
								</span>
								@if (nameMissing()) {
									<span class="hint invalid">{{ 'CHAT.SETTINGS.NAME_REQUIRED' | translate }}</span>
								}
							</label>
						}
						<label class="field">
							<span class="label-line">
								<span class="label">{{ 'CHAT.SETTINGS.TOPIC' | translate }}</span>
								@if (context.canManage) {
									<span class="counter">{{ topic().length }}/250</span>
								}
							</span>
							<input
								nbInput
								fullWidth
								data-test="settings-topic"
								[disabled]="!context.canManage"
								[placeholder]="'CHAT.SETTINGS.TOPIC_PLACEHOLDER' | translate"
								[ngModel]="topic()"
								(ngModelChange)="topic.set($event)"
								maxlength="250"
							/>
							<span class="hint">{{ 'CHAT.SETTINGS.TOPIC_HINT' | translate }}</span>
						</label>
						@if (isChannel()) {
							<label class="field">
								<span class="label">{{ 'CHAT.SETTINGS.CATEGORY' | translate }}</span>
								<nb-select
									fullWidth
									data-test="settings-category"
									[disabled]="!context.canManage"
									[placeholder]="'CHAT.SETTINGS.NO_CATEGORY' | translate"
									[selected]="categoryId()"
									(selectedChange)="categoryId.set($event)"
								>
									<nb-option [value]="null">{{ 'CHAT.SETTINGS.NO_CATEGORY' | translate }}</nb-option>
									@for (category of categories(); track category.id) {
										<nb-option [value]="category.id">{{ category.name }}</nb-option>
									}
								</nb-select>
							</label>
							<div class="option" [class.disabled]="!context.canManage">
								<span class="option-icon"><nb-icon [icon]="isPrivate() ? 'lock-outline' : 'hash-outline'"></nb-icon></span>
								<span class="option-text">
									<span class="option-title">{{ 'CHAT.DIALOG.PRIVATE_CHANNEL' | translate }}</span>
									<span class="hint">{{ (isPrivate() ? 'CHAT.SETTINGS.PRIVATE_ON' : 'CHAT.SETTINGS.PRIVATE_OFF') | translate }}</span>
								</span>
								<nb-toggle data-test="settings-private" status="primary" [disabled]="!context.canManage" [checked]="isPrivate()" (checkedChange)="isPrivate.set($event)">
									<span class="sr-only">{{ 'CHAT.DIALOG.PRIVATE_CHANNEL' | translate }}</span>
								</nb-toggle>
							</div>
						}
					</div>
				}

				@if (tab() === 'members') {
					<div class="panel" role="tabpanel" [attr.id]="idBase + '-panel-members'" [attr.aria-labelledby]="idBase + '-tab-members'">
						<div class="search">
							<nb-icon icon="search-outline" aria-hidden="true"></nb-icon>
							<input
								nbInput
								fullWidth
								type="search"
								data-test="settings-member-search"
								[placeholder]="'CHAT.SETTINGS.FIND_MEMBERS' | translate"
								[attr.aria-label]="'CHAT.SETTINGS.FIND_MEMBERS' | translate"
								[ngModel]="memberQuery()"
								(ngModelChange)="memberQuery.set($event)"
							/>
						</div>
						@if (canEditMembers()) {
							<div class="add">
								<nb-select fullWidth multiple data-test="settings-add-people" [selected]="toAdd()" (selectedChange)="toAdd.set($event ?? [])" [placeholder]="'CHAT.SETTINGS.ADD_PEOPLE' | translate">
									@for (person of addable(); track person.employeeId) {
										<nb-option [value]="person.employeeId">{{ person.name }}</nb-option>
									}
								</nb-select>
								<button nbButton size="small" status="primary" type="button" data-test="settings-add" [disabled]="!toAdd().length || busy() || closeRequested()" (click)="add()">
									<nb-icon icon="person-add-outline"></nb-icon>
									{{ 'CHAT.SETTINGS.ADD' | translate }}
								</button>
							</div>
						} @else if (context.conversation.isDefault) {
							<p class="read-only">
								<nb-icon icon="info-outline"></nb-icon>
								<span>{{ 'CHAT.SETTINGS.DEFAULT_NOTE' | translate }}</span>
							</p>
						}
						@if (loadingMembers()) {
							<div class="loading" [nbSpinner]="true"></div>
						} @else {
							<ul class="member-list" data-test="settings-members">
								@for (member of shownMembers(); track member.employeeId) {
									<li class="member">
										<ngx-chat-person-avatar [person]="member.person" [fallbackName]="member.name" size="medium"></ngx-chat-person-avatar>
										<span class="member-text">
											<span class="member-name">
												{{ member.name }}
												@if (member.isMe) {
													<span class="muted">({{ 'CHAT.SETTINGS.YOU' | translate }})</span>
												}
											</span>
											<span class="member-meta" data-test="member-meta">
												<!-- Their position, then "Manager" for a manager; "Member" when neither says more. -->
												@if (member.position) {
													{{ member.position }}
													@if (member.role === 'manager') {
														<span aria-hidden="true">·</span>
														{{ 'CHAT.SETTINGS.MANAGER' | translate }}
													}
												} @else {
													{{ (member.role === 'manager' ? 'CHAT.SETTINGS.MANAGER' : 'CHAT.SETTINGS.MEMBER') | translate }}
												}
											</span>
										</span>
										@if (canEditMembers() && !member.isMe) {
											<button
												type="button"
												class="remove"
												[attr.data-test]="'remove-member-' + member.employeeId"
												[nbTooltip]="'CHAT.SETTINGS.REMOVE' | translate"
												[attr.aria-label]="'CHAT.SETTINGS.REMOVE_NAMED' | translate: { name: member.name }"
												[disabled]="busy() || closeRequested()"
												(click)="remove(member)"
											>
												<nb-icon icon="person-remove-outline"></nb-icon>
											</button>
										}
									</li>
								} @empty {
									<li class="empty" data-test="settings-members-empty">
										@if (memberQuery().trim()) {
											{{ 'CHAT.DIALOG.NO_PEOPLE_FOR' | translate: { query: memberQuery().trim() } }}
										} @else {
											{{ 'CHAT.DIALOG.NO_PEOPLE' | translate }}
										}
									</li>
								}
							</ul>
						}
					</div>
				}
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" data-test="settings-cancel" (click)="close()">{{ (hasChanges() ? 'CHAT.DIALOG.CANCEL' : 'CHAT.DIALOG.CLOSE') | translate }}</button>
				@if (context.canManage && (tab() === 'settings' || hasChanges())) {
					<button nbButton status="primary" type="button" data-test="settings-save" [disabled]="!canSave()" (click)="save()">{{ 'CHAT.SETTINGS.SAVE' | translate }}</button>
				}
			</nb-card-footer>
		</nb-card>
	`,
	styles: [SETTINGS_DIALOG_STYLES, CHANNEL_SETTINGS_STYLES]
})
export class ChannelSettingsDialogComponent implements OnInit, AfterViewInit {
	protected readonly ref = inject<NbDialogRef<ChannelSettingsDialogComponent>>(NbDialogRef);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly api = inject(ChatUiService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by `NbDialogService.open(…, { context })`. */
	context: ChannelSettingsContext = {
		conversation: null as unknown as IChatConversationWithState,
		categories: [],
		people: EMPTY_PEOPLE,
		meEmployeeId: null,
		canManage: false
	};

	private readonly webhooksApi = inject(ChatWebhooksService);
	/** Which tab shows: the settings, the members, or the channel's incoming webhooks (for its managers, where webhooks are on). */
	protected readonly tab = signal<SettingsTab>('settings');
	/** The channel's webhooks as first read; null while unknown, or where the API answers 404 (webhooks off): no tab. */
	protected readonly webhooks = signal<IChatWebhook[] | null>(null);
	/** Whether the Integrations tab has a webhook write under way (Close then waits for it). */
	private webhookBusy = false;
	/** The conversation as the last Save answered it: later edits are compared with it (null before any save). */
	private readonly saved = signal<IChatConversationWithState | null>(null);
	/** A webhook URL or signing secret is on screen, not yet dismissed: a Save does not close the dialog over it. */
	protected secretOnScreen = false;
	/** The last webhook write failed and its error is on screen (until the next write): a Save does not close over it. */
	private webhookError = false;
	/** The webhook list could not be read for another reason than webhooks being off (a 404): the tab offers a retry. */
	protected readonly webhooksFailed = signal(false);
	/** Whether the Integrations tab shows: webhooks are served here, or their list failed for another reason. */
	protected readonly hasIntegrations = computed(() => this.webhooks() !== null || this.webhooksFailed());
	/** The tabs, in order: About, Members, and Integrations where it shows. */
	protected readonly tabs = computed<SettingsTab[]>(() => (this.hasIntegrations() ? ['settings', 'members', 'integrations'] : ['settings', 'members']));
	/** What the Members tab's search narrows the list to. */
	protected readonly memberQuery = signal('');
	/** Ids that tie the tabs to their panels, unique per dialog. */
	protected readonly idBase = `chat-settings-${++channelSettingsDialogs}`;
	protected readonly name = signal('');
	protected readonly topic = signal('');
	protected readonly isPrivate = signal(false);
	protected readonly categoryId = signal<string | null>(null);
	protected readonly memberSummaries = signal<IChatMemberSummary[]>([]);
	protected readonly loadingMembers = signal(true);
	protected readonly toAdd = signal<string[]>([]);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	/** The conversation as the API last answered it (after a member change). */
	private changed: IChatConversationWithState | null = null;
	/** Counts the conversation reads after member changes: only the latest one's answer is kept. */
	private refreshRun = 0;
	/** Whether the latest of those reads is still under way (Close then waits for it). */
	private refreshing = false;
	/** Close was asked for while a write or the read after it ran: no new write starts, and the dialog closes after them. */
	protected readonly closeRequested = signal(false);

	protected readonly isChannel = computed(() => this.context.conversation?.kind === ChatConversationKindEnum.CHANNEL);
	protected readonly categories = computed(() => sortCategories(this.context.categories ?? []));
	protected readonly canEditMembers = computed(
		() => this.context.canManage && !this.context.conversation?.isDefault && this.context.conversation?.kind !== ChatConversationKindEnum.DIRECT
	);
	protected readonly members = computed<MemberRow[]>(() =>
		this.memberSummaries()
			.map((member) => {
				const person = this.context.people.byEmployee.get(String(member.employeeId)) ?? null;
				return {
					employeeId: String(member.employeeId),
					name: person?.name ?? '…',
					person,
					role: member.role,
					isMe: !!this.context.meEmployeeId && String(member.employeeId) === this.context.meEmployeeId,
					position: person?.position || null
				};
			})
			.sort((a, b) => Number(b.role === ChatMemberRoleEnum.MANAGER) - Number(a.role === ChatMemberRoleEnum.MANAGER) || a.name.localeCompare(b.name))
	);
	/** The members the search matches (all of them while it is empty). */
	protected readonly shownMembers = computed<MemberRow[]>(() => {
		const query = this.memberQuery().trim().toLocaleLowerCase();
		return query ? this.members().filter((member) => member.name.toLocaleLowerCase().includes(query)) : this.members();
	});
	/** The header: the channel as last saved (its name and privacy), or the dialog's title for a direct or group conversation. */
	private readonly shown = computed(() => this.saved() ?? this.context.conversation);
	/** The channel's name; null for a direct or group conversation (the header then says "Conversation settings"). */
	protected readonly headTitle = computed(() => (this.isChannel() ? this.shown()?.name || null : null));
	protected readonly headTopic = computed(() => this.shown()?.topic || null);
	protected readonly headIcon = computed(() => {
		if (!this.isChannel()) return 'people-outline';
		return this.shown()?.visibility === ChatVisibilityEnum.PRIVATE ? 'lock-outline' : 'hash-outline';
	});
	/** A channel's name was cleared: Save waits for one. */
	protected readonly nameMissing = computed(() => this.isChannel() && !this.name().trim().replace(/^#/, ''));
	protected readonly addable = computed(() => {
		const inside = new Set(this.memberSummaries().map((member) => String(member.employeeId)));
		return this.context.people.list.filter((person) => !inside.has(person.employeeId));
	});
	protected readonly changes = computed<IChatConversationUpdateInput>(() => {
		// Compared with the conversation as last saved (the dialog may stay open after a Save, on a webhook secret).
		const conversation = this.saved() ?? this.context.conversation;
		const input: IChatConversationUpdateInput = {};
		if (!conversation) return input;
		const topic = this.topic().trim();
		if (topic !== (conversation.topic ?? '')) input.topic = topic || null;
		if (this.isChannel()) {
			const name = this.name().trim().replace(/^#/, '');
			if (name && name !== (conversation.name ?? '')) input.name = name;
			const visibility = this.isPrivate() ? ChatVisibilityEnum.PRIVATE : ChatVisibilityEnum.PUBLIC;
			if (visibility !== conversation.visibility) input.visibility = visibility;
			if ((this.categoryId() ?? null) !== (conversation.categoryId ? String(conversation.categoryId) : null)) input.categoryId = this.categoryId() ?? null;
		}
		return input;
	});
	/** Some setting differs from the conversation as last saved. */
	protected readonly hasChanges = computed(() => Object.keys(this.changes()).length > 0);
	protected readonly canSave = computed(() => this.context.canManage && !this.busy() && !this.nameMissing() && this.hasChanges());

	ngOnInit(): void {
		const conversation = this.context.conversation;
		if (!conversation) return;
		this.name.set(conversation.name ?? '');
		this.topic.set(conversation.topic ?? '');
		this.isPrivate.set(conversation.visibility === ChatVisibilityEnum.PRIVATE);
		this.categoryId.set(conversation.categoryId ? String(conversation.categoryId) : null);
		if (this.context.section === 'members') this.tab.set('members');
		this.ref.onBackdropClick?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.close());
		// The Integrations tab, for a channel's managers, where the API serves webhooks (a 404 there means they are off).
		if (this.context.canManage && conversation.kind === ChatConversationKindEnum.CHANNEL) this.loadWebhooks();
		this.api
			.members(conversation.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (members) => {
					this.memberSummaries.set(members);
					this.loadingMembers.set(false);
				},
				error: (error) => {
					this.loadingMembers.set(false);
					this.fail(error);
				}
			});
	}

	protected save(): void {
		if (!this.canSave() || this.closeRequested()) return;
		// Saved: the dialog closes with the conversation as saved, through the same wait as Close (a webhook write under
		// way on the Integrations tab finishes first, and one that made a secret keeps the dialog open on it).
		this.run(this.api.updateConversation(this.context.conversation.id, this.changes()), (answer) => {
			// The saved answer is the newest copy: a conversation read after a member change still on its way is dropped
			// (it started before the save), so it cannot put the old settings back.
			this.refreshRun += 1;
			this.refreshing = false;
			this.changed = answer.conversation;
			this.saved.set(answer.conversation);
			// A secret, or a webhook write's error, shown while the save ran (or before it) stays on screen: the manager
			// closes once it is read.
			if (!this.secretOnScreen && !this.webhookError) this.closeRequested.set(true);
		});
	}

	protected add(): void {
		const ids = this.toAdd();
		if (!ids.length || this.busy() || this.closeRequested()) return;
		if (this.context.conversation.kind === ChatConversationKindEnum.GROUP && this.memberSummaries().length + ids.length > CHAT_GROUP_MAX_MEMBERS) {
			this.error.set(this.translate.instant('CHAT.SETTINGS.GROUP_FULL', { max: CHAT_GROUP_MAX_MEMBERS }));
			return;
		}
		this.run(this.api.addMembers(this.context.conversation.id, ids), (answer) => {
			this.memberSummaries.set(answer.members);
			this.toAdd.set([]);
			this.refreshConversation();
		});
	}

	protected remove(member: MemberRow): void {
		if (this.busy() || this.closeRequested()) return;
		if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.SETTINGS.REMOVE_CONFIRM', { name: member.name }))) return;
		this.run(this.api.removeMember(this.context.conversation.id, member.employeeId), () => {
			this.memberSummaries.set(this.memberSummaries().filter((item) => String(item.employeeId) !== member.employeeId));
			this.refreshConversation();
		});
	}

	/**
	 * Closes with the conversation as last read. While a member write, or the read after it, is under way, Close waits
	 * for both (and no new write starts), so the page gets the conversation as the last change left it. It also waits
	 * for a webhook write: one that makes a URL or a signing secret keeps the dialog open on that secret (shown once).
	 * The backdrop and Escape close through here too (the page opens this dialog without Nebular's own closing).
	 */
	protected close(): void {
		if (this.busy() || this.refreshing || this.webhookBusy) {
			this.closeRequested.set(true);
			return;
		}
		this.ref.close(this.changed);
	}

	protected closeOnEscape(): void {
		this.close();
	}

	/** Reads the channel's webhooks: a 404 means they are off here (no tab); any other failure shows on the tab, with a retry. */
	protected loadWebhooks(): void {
		// A retry keeps the failure (and the tab) on screen until it answers: cleared first, the tab would vanish meanwhile.
		this.webhooksApi
			.list(this.context.conversation.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (webhooks) => {
					this.webhooksFailed.set(false);
					this.webhooks.set(webhooks);
				},
				error: (error: { status?: number } | null) => {
					this.webhooks.set(null);
					this.webhooksFailed.set(error?.status !== 404);
					// Webhooks are off here after all: the Integrations tab goes, and the selection moves to Settings.
					if (!this.hasIntegrations() && this.tab() === 'integrations') this.tab.set('settings');
				}
			});
	}

	/** Arrow keys, Home and End move between the tabs (and the focus with them), as WAI-ARIA tabs do. */
	protected tabKey(event: KeyboardEvent): void {
		const order = this.tabs();
		const at = Math.max(0, order.indexOf(this.tab()));
		let next: SettingsTab | null = null;
		if (event.key === 'ArrowRight') next = order[(at + 1) % order.length];
		else if (event.key === 'ArrowLeft') next = order[(at + order.length - 1) % order.length];
		else if (event.key === 'Home') next = order[0];
		else if (event.key === 'End') next = order[order.length - 1];
		if (!next) return;
		event.preventDefault();
		this.tab.set(next);
		this.host.nativeElement.querySelector<HTMLElement>(`[data-test="tab-${next}"]`)?.focus();
	}

	/** The Integrations tab started or ended a webhook write; a close asked for meanwhile happens once it ended. */
	protected webhookWriting(busy: boolean): void {
		this.webhookBusy = busy;
		// A new write clears the last one's error in the panel.
		if (busy) this.webhookError = false;
		if (!busy) this.closeIfRequested();
	}

	/** A webhook write failed: its tab comes forward with the error, and a close asked for meanwhile is dropped. */
	protected showWebhookFailure(): void {
		this.webhookError = true;
		this.tab.set('integrations');
		this.closeRequested.set(false);
	}

	/** A webhook write made a secret: its tab comes forward, and a close asked for meanwhile is dropped so it is read. */
	protected showWebhookSecrets(): void {
		this.secretOnScreen = true;
		this.tab.set('integrations');
		this.closeRequested.set(false);
	}

	/** A close asked for meanwhile happens once nothing is under way any more. */
	private closeIfRequested(): void {
		if (this.closeRequested() && !this.busy() && !this.refreshing && !this.webhookBusy) this.ref.close(this.changed);
	}

	/** The conversation again after a member change (its member count and avatars), for the page; the latest read wins. */
	private refreshConversation(): void {
		const run = ++this.refreshRun;
		this.refreshing = true;
		const settled = (): void => {
			if (run !== this.refreshRun) return;
			this.refreshing = false;
			this.closeIfRequested();
		};
		this.api
			.getConversation(this.context.conversation.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (conversation) => {
					if (run === this.refreshRun) this.changed = conversation;
					settled();
				},
				error: () => settled()
			});
	}

	/** Opened from the member count: the Members tab shows, its search takes the focus. */
	ngAfterViewInit(): void {
		if (this.context.section !== 'members') return;
		queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[data-test="settings-member-search"]')?.focus?.());
	}

	private run<T>(request: Observable<T>, done: (answer: T) => void): void {
		this.busy.set(true);
		this.error.set(null);
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (answer) => {
				this.busy.set(false);
				this.api.notifyChanged();
				// A member change starts its conversation read here; a close asked for meanwhile waits for it.
				done(answer);
				this.closeIfRequested();
			},
			error: (error) => {
				this.busy.set(false);
				this.fail(error);
				this.closeIfRequested();
			}
		});
	}

	private fail(error: unknown): void {
		this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
	}
}

/**
 * The sidebar categories of the organization's channels (`CHAT_MANAGE`): rename, move up or down, delete (its
 * channels stay, uncategorized), and add. Each change is written at once; closes with whether anything changed.
 */
@Component({
	selector: 'ngx-chat-categories-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="categories-dialog">
			<nb-card-header>{{ 'CHAT.CATEGORIES.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="note">{{ 'CHAT.CATEGORIES.TEXT' | translate }}</p>
				<ul class="rows" data-test="categories">
					@for (category of ordered(); track category.id; let first = $first; let last = $last) {
						<li class="row">
							<input
								nbInput
								fieldSize="small"
								class="grow"
								[attr.data-test]="'category-name-' + category.id"
								[attr.aria-label]="'CHAT.CATEGORIES.NAME' | translate"
								[ngModel]="names()[category.id] ?? category.name"
								(ngModelChange)="rename(category.id, $event)"
								(keydown.enter)="saveName(category)"
								(blur)="saveName(category)"
								maxlength="80"
							/>
							<button nbButton ghost size="tiny" type="button" [disabled]="first || busy() || stale()" [nbTooltip]="'CHAT.CATEGORIES.UP' | translate" [attr.aria-label]="'CHAT.CATEGORIES.UP' | translate" (click)="move(category.id, -1)">
								<nb-icon icon="arrow-upward-outline"></nb-icon>
							</button>
							<button nbButton ghost size="tiny" type="button" [disabled]="last || busy() || stale()" [nbTooltip]="'CHAT.CATEGORIES.DOWN' | translate" [attr.aria-label]="'CHAT.CATEGORIES.DOWN' | translate" (click)="move(category.id, 1)">
								<nb-icon icon="arrow-downward-outline"></nb-icon>
							</button>
							<button nbButton ghost size="tiny" type="button" [attr.data-test]="'category-delete-' + category.id" [disabled]="busy()" [nbTooltip]="'CHAT.CATEGORIES.DELETE' | translate" [attr.aria-label]="'CHAT.CATEGORIES.DELETE' | translate" (click)="remove(category)">
								<nb-icon icon="trash-2-outline"></nb-icon>
							</button>
						</li>
					} @empty {
						<li class="note">{{ 'CHAT.CATEGORIES.EMPTY' | translate }}</li>
					}
				</ul>
				<div class="add">
					<input nbInput fullWidth data-test="category-new" [placeholder]="'CHAT.CATEGORIES.NEW' | translate" [ngModel]="newName()" (ngModelChange)="newName.set($event)" (keydown.enter)="create()" maxlength="80" />
					<button nbButton size="small" status="basic" type="button" data-test="category-add" [disabled]="!newName().trim() || busy()" (click)="create()">{{ 'CHAT.CATEGORIES.ADD' | translate }}</button>
				</div>
				@if (error()) {
					<p class="error" role="alert">
						{{ error() }}
						@if (stale()) {
							<button nbButton ghost size="tiny" type="button" data-test="categories-reload" [disabled]="busy()" (click)="reload()">{{ 'CHAT.RETRY' | translate }}</button>
						}
					</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton status="primary" type="button" data-test="categories-close" (click)="close()">{{ 'CHAT.DIALOG.CLOSE' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [SETTINGS_DIALOG_STYLES]
})
export class CategoriesDialogComponent implements OnInit {
	protected readonly ref = inject<NbDialogRef<CategoriesDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by `NbDialogService.open(…, { context })`. */
	categories: readonly IChatCategory[] = [];

	protected readonly list = signal<IChatCategory[]>([]);
	protected readonly names = signal<Record<string, string>>({});
	protected readonly newName = signal('');
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly ordered = computed(() => sortCategories(this.list()));
	/** A move failed part way and the list could not be read again: moves wait for a successful read. */
	protected readonly stale = signal(false);
	protected changedAny = false;
	/** Close was asked for while a write ran: the dialog closes once it ends. */
	private closing = false;

	ngOnInit(): void {
		this.list.set([...(this.categories ?? [])]);
	}

	protected rename(id: string, name: string): void {
		this.names.set({ ...this.names(), [id]: name });
	}

	protected saveName(category: IChatCategory): void {
		const name = (this.names()[category.id] ?? category.name).trim();
		if (!name || name === category.name || this.busy()) return;
		this.run(this.api.updateCategory(category.id, { name }), (saved) => this.replace(saved));
	}

	protected move(id: string, direction: -1 | 1): void {
		const order = movedCategoryOrder(this.list(), id, direction);
		if (!order || this.busy() || this.stale()) return;
		// One call saves the whole order in one transaction (all of it or none); after a failure the list is read again.
		this.run(
			this.api.reorderCategories({ categoryIds: order }),
			(result) => this.placeAll(result.categories ?? []),
			() => this.reload()
		);
	}

	/** Puts the positions the platform saved on the categories shown (one created meanwhile shows on the next read). */
	private placeAll(saved: readonly IChatCategory[]): void {
		const positions = new Map(saved.map((category) => [String(category.id), category.position]));
		this.list.set(this.list().map((item) => (positions.has(String(item.id)) ? { ...item, position: positions.get(String(item.id)) as number } : item)));
	}

	protected remove(category: IChatCategory): void {
		if (this.busy()) return;
		if (typeof window !== 'undefined' && !window.confirm(this.translate.instant('CHAT.CATEGORIES.DELETE_CONFIRM', { name: category.name }))) return;
		this.run(this.api.deleteCategory(category.id), () => this.list.set(this.list().filter((item) => item.id !== category.id)));
	}

	protected create(): void {
		const name = this.newName().trim();
		if (!name || this.busy()) return;
		this.run(this.api.createCategory({ name, position: nextCategoryPosition(this.list()) }), (created) => {
			this.list.set([...this.list(), created]);
			this.newName.set('');
		});
	}

	/** Puts the API's category in place; a name typed since the write was sent stays in the box. */
	private replace(category: IChatCategory): void {
		this.list.set(this.list().map((item) => (item.id === category.id ? { ...item, ...category } : item)));
		const draft = this.names()[category.id];
		if (draft === undefined || draft.trim() === (category.name ?? '').trim()) {
			const names = { ...this.names() };
			delete names[category.id];
			this.names.set(names);
		}
	}

	/** Closes with whether anything changed; while a write (or its recovery read) runs, once it ends. */
	protected close(): void {
		if (this.busy()) {
			this.closing = true;
			return;
		}
		this.ref.close(this.changedAny);
	}

	/**
	 * The categories as the API has them now, after a move that failed half way: the actions stay blocked until this
	 * read ends; if it fails too, moves wait for a successful one (Retry).
	 */
	protected reload(): void {
		this.busy.set(true);
		this.api
			.categories()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (categories) => {
					this.list.set([...categories]);
					this.names.set({});
					this.stale.set(false);
					this.changedAny = true;
					this.api.notifyChanged();
					this.settle();
				},
				error: () => {
					this.stale.set(true);
					this.settle();
				}
			});
	}

	private run<T>(request: Observable<T>, done: (answer: T) => void, failed?: () => void): void {
		this.busy.set(true);
		this.error.set(null);
		request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: (answer) => {
				this.changedAny = true;
				this.api.notifyChanged();
				done(answer);
				this.settle();
			},
			error: (error) => {
				this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				// The recovery read keeps the dialog busy until it ends.
				if (failed) failed();
				else this.settle();
			}
		});
	}

	/** A write (or its recovery read) ended: the actions are free again, and a Close asked for meanwhile happens. */
	private settle(): void {
		this.busy.set(false);
		if (this.closing) {
			this.closing = false;
			this.ref.close(this.changedAny);
		}
	}
}
