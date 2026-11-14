import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbAutocompleteModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbDialogRef, NbIconModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CHAT_GROUP_MAX_MEMBERS, ChatVisibilityEnum, IChatConversationWithState } from '@gauzy/contracts';
import { ChatTeam, teamSuggestions } from '../chat-team-suggestions';
import { apiErrorMessage, ChatPerson, rankMentions } from '../chat-ui.helpers';
import { ChatPeople, EMPTY_PEOPLE } from '../services/chat-people.service';
import { ChatUiService } from '../services/chat-ui.service';
import { PersonAvatarComponent } from '../components/person-avatar/person-avatar.component';

const DIALOG_STYLES = `
		.dialog {
			width: min(32rem, 92vw);
			max-height: 85vh;
		}
		.text {
			margin: 0 0 0.75rem;
			font-size: 0.875rem;
			opacity: 0.8;
		}
		.field {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin-bottom: 0.75rem;
			font-size: 0.8125rem;
		}
		.people {
			max-height: 40vh;
			overflow-y: auto;
			margin: 0.5rem 0 0;
			padding: 0;
			list-style: none;
		}
		.person {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.25rem 0.375rem;
			border-radius: 0.25rem;
			font-size: 0.875rem;
			cursor: pointer;
		}
		.person:hover,
		.person.selected {
			background: rgba(127, 127, 127, 0.12);
		}
		.person.channel {
			cursor: default;
		}
		.grow {
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			min-width: 0;
		}
		.grow small {
			opacity: 0.7;
		}
		.empty {
			padding: 0.5rem 0.375rem;
			font-size: 0.875rem;
			opacity: 0.7;
		}
		.error {
			margin: 0.5rem 0 0;
			color: var(--color-danger-default, #e4493f);
			font-size: 0.8125rem;
		}
		.footer {
			display: flex;
			justify-content: flex-end;
			gap: 0.5rem;
		}
		.loading {
			min-height: 5rem;
		}
		.hint {
			font-size: 0.75rem;
			line-height: 1.4;
			color: var(--gauzy-text-color-2);
		}
		.team {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			min-width: 0;
		}
		.team nb-icon {
			flex: 0 0 auto;
			font-size: 1rem;
			color: var(--gauzy-text-color-2);
		}
		.team-name {
			flex: 1 1 auto;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.team-taken {
			flex: 0 0 auto;
			font-size: 0.75rem;
			color: var(--gauzy-text-color-2);
		}
	`;


/** The new-message dialog lists this many people at most (typing narrows it). */
const DIRECT_CANDIDATES = 50;

/** What the page passes to the new-channel dialog: where the teams are read, and the channels already listed. */
export interface NewChannelContext {
	organizationId: string | null;
	tenantId: string | null;
	/** The names of the channels the page lists: a team name one of them has is marked as taken. */
	channelNames: readonly string[];
}

/**
 * A new channel: name, topic, private or public. The name field suggests the organization's team names (where the
 * person may read the teams), narrowed as they type; a name a listed channel already has is shown but cannot be
 * picked. Closes with the conversation.
 */
@Component({
	selector: 'ngx-chat-new-channel-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbAutocompleteModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbIconModule, NbInputModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="new-channel-dialog">
			<nb-card-header>{{ 'CHAT.DIALOG.NEW_CHANNEL' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="text">{{ 'CHAT.DIALOG.NEW_CHANNEL_TEXT' | translate }}</p>
				<label class="field">
					<span>{{ 'CHAT.DIALOG.CHANNEL_NAME' | translate }}</span>
					<input
						nbInput
						fullWidth
						data-test="channel-name"
						[nbAutocomplete]="teamList"
						[ngModel]="name()"
						(ngModelChange)="name.set($event ?? '')"
						maxlength="80"
						autofocus
					/>
					<nb-autocomplete #teamList data-test="channel-team-suggestions">
						@if (suggestions().length) {
							<nb-option-group [title]="'CHAT.DIALOG.TEAMS' | translate">
								@for (team of suggestions(); track team.id) {
									<nb-option [value]="team.name" [disabled]="team.taken" [attr.data-test]="'channel-team-' + team.id">
										<span class="team">
											<nb-icon icon="people-outline"></nb-icon>
											<span class="team-name">{{ team.name }}</span>
											@if (team.taken) {
												<small class="team-taken">{{ 'CHAT.DIALOG.TEAM_TAKEN' | translate }}</small>
											}
										</span>
									</nb-option>
								}
							</nb-option-group>
						}
					</nb-autocomplete>
					@if (teams().length) {
						<span class="hint">{{ 'CHAT.DIALOG.TEAM_HINT' | translate }}</span>
					}
				</label>
				<label class="field">
					<span>{{ 'CHAT.DIALOG.CHANNEL_TOPIC' | translate }}</span>
					<input nbInput fullWidth data-test="channel-topic" [ngModel]="topic()" (ngModelChange)="topic.set($event)" maxlength="250" />
				</label>
				<nb-checkbox data-test="channel-private" [checked]="isPrivate()" (checkedChange)="isPrivate.set($event)">{{ 'CHAT.DIALOG.PRIVATE_CHANNEL' | translate }}</nb-checkbox>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" data-test="channel-create" [disabled]="!canCreate()" (click)="create()">
					{{ 'CHAT.DIALOG.CREATE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [DIALOG_STYLES]
})
export class NewChannelDialogComponent implements OnInit, NewChannelContext {
	protected readonly ref = inject<NbDialogRef<NewChannelDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by `NbDialogService.open(…, { context })`. */
	organizationId: string | null = null;
	tenantId: string | null = null;
	channelNames: readonly string[] = [];

	/** The organization's teams, or none where they cannot be read (no `ORG_TEAM_VIEW`, or the read failed). */
	protected readonly teams = signal<ChatTeam[]>([]);
	protected readonly name = signal('');
	/** The team names to offer for what is typed. */
	protected readonly suggestions = computed(() => teamSuggestions(this.teams(), this.name(), this.channelNames));
	protected readonly topic = signal('');
	protected readonly isPrivate = signal(false);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly canCreate = computed(() => !!this.name().trim().replace(/^#/, '') && !this.busy());

	ngOnInit(): void {
		if (!this.organizationId || !this.tenantId) return;
		this.api
			.teams(this.organizationId, this.tenantId)
			.pipe(
				catchError(() => of([] as ChatTeam[])),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((teams) => this.teams.set(teams));
	}

	protected create(): void {
		const name = this.name().trim().replace(/^#/, '');
		if (!name || this.busy()) return;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.createChannel({
				name,
				topic: this.topic().trim() || null,
				visibility: this.isPrivate() ? ChatVisibilityEnum.PRIVATE : ChatVisibilityEnum.PUBLIC
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => this.ref.close(answer.conversation),
				error: (error) => {
					this.busy.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}
}

/**
 * A new direct or group conversation, as chat apps start one: a "To:" field that gathers the chosen people as
 * removable chips (Backspace takes the last one back), the people ranked by how well they match what is typed
 * (the match in bold, a check on the chosen ones), the keyboard all the way (↑ ↓ to move, Enter to add or remove,
 * Ctrl/⌘ + Enter to start), and a footer that says what will open: a direct message, or a group of how many.
 * Closes with the conversation.
 */
@Component({
	selector: 'ngx-chat-new-direct-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, NbIconModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<nb-card class="direct" data-test="new-direct-dialog" role="dialog" aria-labelledby="new-direct-title" aria-describedby="new-direct-text">
			<nb-card-header class="head">
				<div class="head-line">
					<span class="head-icon"><nb-icon icon="message-circle-outline"></nb-icon></span>
					<div class="head-text">
						<h5 id="new-direct-title" class="head-title">{{ 'CHAT.DIALOG.NEW_MESSAGE' | translate }}</h5>
						<span id="new-direct-text" class="head-topic">{{ 'CHAT.DIALOG.NEW_MESSAGE_TEXT' | translate: { max: max } }}</span>
					</div>
					<button type="button" class="head-close" [attr.aria-label]="'CHAT.DIALOG.CLOSE' | translate" (click)="ref.close(null)">
						<nb-icon icon="close-outline"></nb-icon>
					</button>
				</div>
			</nb-card-header>

			<nb-card-body class="body">
				<!-- The search, with the chosen people as removable chips in front of it (Backspace takes the last one back). -->
				<div class="to" [class.focused]="focused()" (click)="focusSearch()">
					<nb-icon class="to-icon" icon="search-outline" aria-hidden="true"></nb-icon>
					@for (person of chosen(); track person.employeeId) {
						<span class="token" data-test="direct-token">
							<ngx-chat-person-avatar [person]="person" size="tiny" [presence]="false"></ngx-chat-person-avatar>
							<span class="token-name">{{ person.name }}</span>
							<button
								type="button"
								class="token-remove"
								[attr.aria-label]="'CHAT.DIALOG.REMOVE_PERSON' | translate: { name: person.name }"
								(click)="remove(person.employeeId); $event.stopPropagation()"
							>
								<nb-icon icon="close-outline"></nb-icon>
							</button>
						</span>
					}
					<input
						#search
						cdkFocusInitial
						type="text"
						class="to-input"
						data-test="people-search"
						autocomplete="off"
						role="combobox"
						aria-controls="new-direct-people"
						aria-expanded="true"
						[attr.aria-label]="'CHAT.DIALOG.SEARCH_PEOPLE' | translate"
						[attr.aria-activedescendant]="candidates().length ? 'new-direct-person-' + highlighted() : null"
						[placeholder]="(chosen().length ? 'CHAT.DIALOG.TO_MORE' : 'CHAT.DIALOG.TO_PLACEHOLDER') | translate"
						[value]="query()"
						(input)="onQuery($any($event.target).value)"
						(keydown)="onKeydown($event)"
						(focus)="focused.set(true)"
						(blur)="focused.set(false)"
					/>
				</div>

				<ul id="new-direct-people" class="list" role="listbox" aria-multiselectable="true" [attr.aria-label]="'CHAT.DIALOG.PEOPLE' | translate">
					@for (item of candidates(); track item.person.employeeId; let index = $index) {
						@let isChosen = chosenIds().has(item.person.employeeId);
						<li
							role="option"
							class="person-row"
							[id]="'new-direct-person-' + index"
							[attr.data-index]="index"
							[attr.aria-selected]="isChosen"
							[attr.aria-disabled]="!isChosen && full()"
							[class.highlighted]="index === highlighted()"
							[class.chosen]="isChosen"
							[class.blocked]="!isChosen && full()"
							(mouseenter)="highlighted.set(index)"
							(mousedown)="$event.preventDefault()"
							(click)="toggle(item.person.employeeId)"
						>
							<ngx-chat-person-avatar [person]="item.person" size="medium"></ngx-chat-person-avatar>
							<span class="row-text">
								<span class="row-name">{{ item.parts.before }}<mark>{{ item.parts.match }}</mark>{{ item.parts.after }}</span>
								@if (item.person.position) {
									<span class="row-meta">{{ item.person.position }}</span>
								}
							</span>
							<span class="check" aria-hidden="true">
								@if (isChosen) {
									<nb-icon icon="checkmark-outline"></nb-icon>
								}
							</span>
						</li>
					} @empty {
						<li class="empty">
							@if (query().trim()) {
								{{ 'CHAT.DIALOG.NO_PEOPLE_FOR' | translate: { query: query().trim() } }}
							} @else {
								{{ 'CHAT.DIALOG.NO_PEOPLE' | translate }}
							}
						</li>
					}
				</ul>

				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>

			<nb-card-footer class="foot">
				<span class="summary" aria-live="polite">
					@if (full()) {
						{{ 'CHAT.DIALOG.GROUP_FULL' | translate: { max: max } }}
					} @else if (chosen().length === 1) {
						{{ 'CHAT.DIALOG.DIRECT_WITH' | translate: { name: chosen()[0].name } }}
					} @else if (chosen().length > 1) {
						{{ 'CHAT.DIALOG.GROUP_OF' | translate: { count: chosen().length } }}
					} @else {
						<span class="keys" aria-hidden="true">
							<span><kbd>↑</kbd><kbd>↓</kbd> {{ 'CHAT.DIALOG.KEY_MOVE' | translate }}</span>
							<span><kbd>↵</kbd> {{ 'CHAT.DIALOG.KEY_ADD' | translate }}</span>
							<span><kbd>Ctrl</kbd><kbd>↵</kbd> {{ 'CHAT.DIALOG.KEY_START' | translate }}</span>
						</span>
					}
				</span>
				<div class="actions">
					<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
					<button nbButton status="primary" type="button" data-test="direct-start" [disabled]="chosen().length === 0 || busy()" (click)="start()">
						{{ (chosen().length > 1 ? 'CHAT.DIALOG.START_GROUP' : 'CHAT.DIALOG.OPEN_DIRECT') | translate }}
					</button>
				</div>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			/* The look of the conversation settings (header, body, footer), so the chat's dialogs read as one. */
			.direct {
				display: flex;
				flex-direction: column;
				width: min(38rem, 94vw);
				max-height: 90vh;
				margin: 0;
			}
			.head {
				padding: 1rem 1.25rem;
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
				font-size: 0.8125rem;
				line-height: 1.35;
				opacity: 0.65;
			}
			.head-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				flex: 0 0 auto;
				align-self: flex-start;
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

			/* One fixed-height body: the search stays, the list scrolls under it. */
			.body {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				height: min(28rem, 62vh);
				padding: 1.25rem;
				overflow: hidden;
			}

			/* The search box, drawn as the theme's inputs are (as the members search is). */
			.to {
				display: flex;
				flex: 0 0 auto;
				flex-wrap: wrap;
				align-items: center;
				align-content: flex-start;
				gap: 0.375rem;
				min-height: 2.5rem;
				max-height: 7.5rem;
				overflow-y: auto;
				padding: 0.3125rem 0.75rem;
				box-sizing: border-box;
				border: 1px solid var(--input-basic-border-color, var(--gauzy-border-default-color));
				border-radius: var(--border-radius);
				background: var(--input-basic-background-color, transparent);
				cursor: text;
				transition: border-color 0.12s ease;
			}
			.to.focused {
				border-color: var(--input-basic-focus-border-color, var(--color-primary-default));
			}
			.to-icon {
				flex: 0 0 auto;
				margin-right: 0.25rem;
				font-size: 1rem;
				opacity: 0.55;
			}
			.token {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				gap: 0.375rem;
				max-width: 100%;
				height: 1.75rem;
				box-sizing: border-box;
				padding: 0 0.125rem 0 0.25rem;
				border-radius: calc(var(--border-radius) * 0.75);
				background: var(--gauzy-sidebar-background-3);
				font-size: 0.8125rem;
				font-weight: 600;
			}
			.token-name {
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.token-remove {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 1.375rem;
				height: 1.375rem;
				padding: 0;
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: inherit;
				opacity: 0.6;
				cursor: pointer;
			}
			.token-remove:hover,
			.token-remove:focus-visible {
				background: var(--gauzy-hover-tint);
				opacity: 1;
			}
			.token-remove nb-icon {
				font-size: 0.875rem;
			}
			/* A bare input inside the box; global form styles reach it, so all it shows is set here. */
			.to-input {
				flex: 1 1 8rem;
				min-width: 8rem;
				height: 1.75rem !important;
				margin: 0 !important;
				padding: 0 !important;
				border: 0 !important;
				outline: 0 !important;
				background: transparent !important;
				box-shadow: none !important;
				color: inherit !important;
				font: inherit;
				font-size: 0.9375rem !important;
			}
			.to-input::placeholder {
				color: var(--input-basic-placeholder-text-color, inherit);
				opacity: 0.6;
			}

			/* The people, as the members list draws them. */
			.list {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				margin: 0 -0.5rem;
				padding: 0;
				list-style: none;
			}
			.person-row {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				padding: 0.3125rem 0.5rem;
				border-radius: calc(var(--border-radius) * 0.75);
				cursor: pointer;
			}
			/* One highlighted row (mouse or arrows). */
			.person-row.highlighted {
				background: var(--gauzy-hover-tint);
			}
			.person-row.blocked {
				cursor: not-allowed;
				opacity: 0.5;
			}
			.row-text {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				min-width: 0;
				line-height: 1.25;
			}
			.row-name,
			.row-meta {
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.row-name {
				font-size: 0.8125rem;
				font-weight: 600;
			}
			.row-name mark {
				padding: 0;
				background: transparent;
				color: inherit;
				font-weight: 800;
				text-decoration: underline;
				text-underline-offset: 0.15em;
			}
			.row-meta {
				font-size: 0.6875rem;
				opacity: 0.6;
			}
			.check {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex: 0 0 auto;
				width: 1.125rem;
				height: 1.125rem;
				box-sizing: border-box;
				border: 1px solid var(--gauzy-border-default-color);
				border-radius: 0.25rem;
			}
			.person-row.chosen .check {
				border-color: var(--color-primary-default);
				background: var(--color-primary-default);
				color: var(--text-control-color);
			}
			.check nb-icon {
				font-size: 0.875rem;
			}
			.empty {
				padding: 1.5rem 0.5rem;
				text-align: center;
				font-size: 0.8125rem;
				opacity: 0.65;
			}
			.error {
				flex: 0 0 auto;
				margin: 0;
				color: var(--color-danger-default);
				font-size: 0.8125rem;
			}

			.foot {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.75rem 1.25rem;
			}
			.summary {
				min-width: 0;
				font-size: 0.8125rem;
				opacity: 0.7;
			}
			.keys {
				display: flex;
				flex-wrap: wrap;
				gap: 0.25rem 0.75rem;
			}
			kbd {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 1.125rem;
				height: 1.125rem;
				margin-right: 0.125rem;
				padding: 0 0.25rem;
				border: 1px solid var(--gauzy-border-default-color);
				border-radius: 0.25rem;
				background: transparent;
				box-shadow: none;
				color: inherit;
				font-family: inherit;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			@media (max-width: 600px) {
				.keys {
					display: none;
				}
			}
			.actions {
				display: flex;
				flex: 0 0 auto;
				gap: 0.5rem;
			}
		`
	]
})
export class NewDirectDialogComponent implements AfterViewInit {
	protected readonly ref = inject<NbDialogRef<NewDirectDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	/** Set by the opener (dialog context). */
	people: ChatPeople = EMPTY_PEOPLE;
	meEmployeeId: string | null = null;

	private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

	protected readonly max = CHAT_GROUP_MAX_MEMBERS - 1;
	protected readonly query = signal('');
	/** The chosen people's ids, in the order they were picked (the chips' order). */
	protected readonly selected = signal<readonly string[]>([]);
	protected readonly highlighted = signal(0);
	protected readonly focused = signal(false);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);

	protected readonly chosenIds = computed(() => new Set(this.selected()));
	protected readonly chosen = computed(() =>
		this.selected()
			.map((id) => this.people.byEmployee.get(id))
			.filter((person): person is ChatPerson => !!person)
	);
	protected readonly full = computed(() => this.selected().length >= this.max);
	/** Everyone but me, best matches of the query first, the match cut out to be bolded. */
	protected readonly candidates = computed(() =>
		rankMentions(
			this.people.list.filter((person) => person.employeeId !== this.meEmployeeId),
			this.query(),
			{ limit: DIRECT_CANDIDATES }
		)
	);

	ngAfterViewInit(): void {
		// The search takes the focus (`cdkFocusInitial` asks the dialog's focus trap; this is the fallback).
		setTimeout(() => this.focusSearch());
	}

	protected focusSearch(): void {
		this.search()?.nativeElement.focus();
	}

	protected onQuery(value: string): void {
		this.query.set(value);
		this.highlighted.set(0);
	}

	protected onKeydown(event: KeyboardEvent): void {
		// Keys that belong to an IME composition (Enter confirms it) are not commands.
		if (event.isComposing || event.keyCode === 229) return;
		const count = this.candidates().length;
		if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			this.highlighted.set((this.highlighted() + step + count) % count);
			setTimeout(() => this.host.nativeElement.querySelector(`.list [data-index="${this.highlighted()}"]`)?.scrollIntoView({ block: 'nearest' }));
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				this.start();
				return;
			}
			const item = this.candidates()[this.highlighted()];
			if (item) this.toggle(item.person.employeeId);
			else if (!this.query().trim()) this.start();
			return;
		}
		if (event.key === 'Backspace' && !this.query() && this.selected().length) {
			event.preventDefault();
			this.selected.set(this.selected().slice(0, -1));
		}
	}

	/** Adds or removes a person; adding clears the search for the next name. */
	protected toggle(employeeId: string): void {
		if (this.chosenIds().has(employeeId)) {
			this.remove(employeeId);
			return;
		}
		if (this.full()) return;
		this.selected.set([...this.selected(), employeeId]);
		if (this.query()) this.onQuery('');
		this.focusSearch();
	}

	protected remove(employeeId: string): void {
		this.selected.set(this.selected().filter((id) => id !== employeeId));
		this.focusSearch();
	}

	protected start(): void {
		const ids = [...this.selected()];
		if (ids.length === 0 || this.busy()) return;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.direct(ids)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => this.ref.close(answer.conversation),
				error: (error) => {
					this.busy.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}
}

/** The public channels I am not in; Join closes with the joined conversation. */
@Component({
	selector: 'ngx-chat-browse-channels-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="browse-channels-dialog">
			<nb-card-header>{{ 'CHAT.DIALOG.BROWSE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="text">{{ 'CHAT.DIALOG.BROWSE_TEXT' | translate }}</p>
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else {
					<ul class="people">
						@for (channel of channels(); track channel.id) {
							<li class="person channel">
								<nb-icon icon="hash-outline"></nb-icon>
								<span class="grow">
									<strong>{{ channel.name }}</strong>
									@if (channel.topic) {
										<small>{{ channel.topic }}</small>
									}
									<small>{{ 'CHAT.LIST.MEMBERS' | translate: { count: channel.memberCount } }}</small>
								</span>
								<button nbButton size="tiny" status="primary" type="button" [disabled]="busyId() === channel.id" (click)="join(channel)">
									{{ 'CHAT.DIALOG.JOIN' | translate }}
								</button>
							</li>
						} @empty {
							<li class="empty">{{ 'CHAT.DIALOG.NO_CHANNELS_TO_JOIN' | translate }}</li>
						}
					</ul>
				}
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CLOSE' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [DIALOG_STYLES]
})
export class BrowseChannelsDialogComponent implements OnInit {
	protected readonly ref = inject<NbDialogRef<BrowseChannelsDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly channels = signal<IChatConversationWithState[]>([]);
	protected readonly loading = signal(true);
	protected readonly busyId = signal<string | null>(null);
	protected readonly error = signal<string | null>(null);

	ngOnInit(): void {
		this.api
			.browse()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (channels) => {
					this.channels.set(channels);
					this.loading.set(false);
				},
				error: (error) => {
					this.loading.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}

	protected join(channel: IChatConversationWithState): void {
		this.busyId.set(String(channel.id));
		this.api
			.join(channel.id)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => this.ref.close(answer.conversation),
				error: (error) => {
					this.busyId.set(null);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}
}

