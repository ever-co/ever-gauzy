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
			<header class="head">
				<div class="heading">
					<h2 id="new-direct-title" class="title">{{ 'CHAT.DIALOG.NEW_MESSAGE' | translate }}</h2>
					<p id="new-direct-text" class="subtitle">{{ 'CHAT.DIALOG.NEW_MESSAGE_TEXT' | translate: { max: max } }}</p>
				</div>
				<button type="button" class="dialog-close" [attr.aria-label]="'CHAT.DIALOG.CLOSE' | translate" (click)="ref.close(null)">
					<nb-icon icon="close-outline"></nb-icon>
				</button>
			</header>

			<div class="to" [class.focused]="focused()" (click)="focusSearch()">
				<span class="to-label">{{ 'CHAT.DIALOG.TO' | translate }}</span>
				@for (person of chosen(); track person.employeeId) {
					<span class="token" data-test="direct-token">
						<ngx-chat-person-avatar [person]="person" size="tiny"></ngx-chat-person-avatar>
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
					[attr.aria-activedescendant]="candidates().length ? 'new-direct-person-' + highlighted() : null"
					[placeholder]="(chosen().length ? 'CHAT.DIALOG.TO_MORE' : 'CHAT.DIALOG.TO_PLACEHOLDER') | translate"
					[value]="query()"
					(input)="onQuery($any($event.target).value)"
					(keydown)="onKeydown($event)"
					(focus)="focused.set(true)"
					(blur)="focused.set(false)"
				/>
			</div>

			<div class="section-label">{{ 'CHAT.DIALOG.PEOPLE' | translate }}</div>
			<ul id="new-direct-people" class="list" role="listbox" aria-multiselectable="true">
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
						<ngx-chat-person-avatar [person]="item.person" size="small"></ngx-chat-person-avatar>
						<span class="row-name">{{ item.parts.before }}<mark>{{ item.parts.match }}</mark>{{ item.parts.after }}</span>
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

			<footer class="foot">
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
					<button nbButton ghost size="small" type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
					<button nbButton status="primary" size="small" type="button" data-test="direct-start" [disabled]="chosen().length === 0 || busy()" (click)="start()">
						{{ (chosen().length > 1 ? 'CHAT.DIALOG.START_GROUP' : 'CHAT.DIALOG.OPEN_DIRECT') | translate }}
					</button>
				</div>
			</footer>
		</nb-card>
	`,
	styles: [
		`
			/* The dialog lives in the overlay, outside the chat page: it reads the theme's tokens, not the chat's. */
			.direct {
				display: flex;
				flex-direction: column;
				width: min(34rem, 94vw);
				max-height: 85vh;
				margin: 0;
				overflow: hidden;
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.25));
				border-radius: 0.75rem;
				box-shadow: 0 1.25rem 3rem rgba(0, 0, 0, 0.35);
			}
			.head {
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 1rem 1rem 0.875rem 1.25rem;
			}
			.heading {
				display: flex;
				flex-direction: column;
				gap: 0.125rem;
				min-width: 0;
			}
			.title {
				margin: 0;
				font-size: 1.0625rem;
				font-weight: 700;
				line-height: 1.5rem;
			}
			.subtitle {
				margin: 0;
				color: var(--text-hint-color, inherit);
				font-size: 0.75rem;
				line-height: 1.125rem;
			}
			.dialog-close {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border: 0;
				border-radius: 0.375rem;
				background: transparent;
				color: var(--text-hint-color, inherit);
				cursor: pointer;
			}
			.dialog-close:hover,
			.dialog-close:focus-visible {
				background: var(--gauzy-hover-tint, rgba(127, 127, 127, 0.12));
				color: var(--text-basic-color, inherit);
			}
			.dialog-close nb-icon {
				font-size: 1.25rem;
			}

			/* The "To:" field: chips of the chosen people, then the search, in one box. */
			/* Only the list gives way when the dialog is short: the header, the field and the footer keep their height. */
			.head,
			.section-label,
			.error,
			.foot {
				flex: 0 0 auto;
			}
			.to {
				display: flex;
				flex: 0 0 auto;
				flex-wrap: wrap;
				align-items: center;
				align-content: flex-start;
				gap: 0.375rem;
				min-height: 2.75rem;
				/* Many chips: the field scrolls after about four rows instead of pushing the list away. */
				max-height: 9.5rem;
				overflow-y: auto;
				margin: 0 1.25rem;
				padding: 0.4375rem 0.625rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.3));
				border-radius: 0.5rem;
				cursor: text;
				transition: border-color 0.12s ease, box-shadow 0.12s ease;
			}
			.to.focused {
				border-color: var(--text-hint-color, rgba(127, 127, 127, 0.6));
				box-shadow: 0 0 0 0.1875rem var(--gauzy-hover-tint, rgba(127, 127, 127, 0.12));
			}
			.to-label {
				display: inline-flex;
				align-items: center;
				height: 1.75rem;
				margin-right: 0.125rem;
				color: var(--text-hint-color, inherit);
				font-size: 0.875rem;
				font-weight: 600;
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
				border-radius: 0.375rem;
				background: var(--gauzy-active-tint, rgba(127, 127, 127, 0.18));
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
				border: 0;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--text-hint-color, inherit);
				cursor: pointer;
			}
			.token-remove:hover,
			.token-remove:focus-visible {
				background: var(--gauzy-hover-tint, rgba(127, 127, 127, 0.15));
				color: var(--text-basic-color, inherit);
			}
			.token-remove nb-icon {
				font-size: 0.875rem;
			}
			/* A bare input inside the field; global form styles reach it, so all it shows is set here. */
			.to-input {
				flex: 1 1 8rem;
				min-width: 8rem;
				height: 1.75rem !important;
				margin: 0 !important;
				padding: 0 0.25rem !important;
				border: 0 !important;
				outline: 0 !important;
				background: transparent !important;
				box-shadow: none !important;
				color: var(--text-basic-color, inherit) !important;
				font: inherit;
				font-size: 0.875rem !important;
			}
			.to-input::placeholder {
				color: var(--text-hint-color, rgba(127, 127, 127, 0.9));
			}

			.section-label {
				padding: 1rem 1.25rem 0.375rem;
				color: var(--text-hint-color, inherit);
				font-size: 0.6875rem;
				font-weight: 700;
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}
			.list {
				flex: 1 1 auto;
				min-height: 7.5rem;
				max-height: 22rem;
				overflow-y: auto;
				margin: 0;
				padding: 0 0.75rem 0.5rem;
				list-style: none;
				scrollbar-width: thin;
			}
			.person-row {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				min-height: 2.5rem;
				padding: 0.375rem 0.5rem;
				border-radius: 0.5rem;
				font-size: 0.875rem;
				cursor: pointer;
			}
			/* One highlighted row (mouse or arrows), in the neutral hover tint. */
			.person-row.highlighted {
				background: var(--gauzy-hover-tint, rgba(127, 127, 127, 0.12));
			}
			.person-row.blocked {
				cursor: not-allowed;
				opacity: 0.5;
			}
			.row-name {
				flex: 1 1 auto;
				min-width: 0;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}
			.row-name mark {
				padding: 0;
				background: transparent;
				color: inherit;
				font-weight: 700;
			}
			.person-row.chosen .row-name {
				font-weight: 600;
			}
			.check {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				flex: 0 0 auto;
				width: 1.25rem;
				height: 1.25rem;
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.4));
				border-radius: 50%;
			}
			.person-row.chosen .check {
				border-color: transparent;
				background: var(--text-basic-color, #222);
				color: var(--gauzy-card-1, #fff);
			}
			.check nb-icon {
				font-size: 0.875rem;
			}
			.empty {
				padding: 1.5rem 0.5rem;
				color: var(--text-hint-color, inherit);
				font-size: 0.875rem;
				text-align: center;
			}
			.error {
				margin: 0.25rem 1.25rem 0;
				color: var(--color-danger-default, #e4493f);
				font-size: 0.8125rem;
			}

			.foot {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.75rem;
				padding: 0.75rem 1rem 0.75rem 1.25rem;
				border-top: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.2));
			}
			.summary {
				min-width: 0;
				color: var(--text-hint-color, inherit);
				font-size: 0.75rem;
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
				border: 1px solid var(--gauzy-border-default-color, rgba(127, 127, 127, 0.35));
				border-radius: 0.25rem;
				background: transparent;
				box-shadow: none;
				color: inherit;
				font-family: inherit;
				font-size: 0.625rem;
				font-weight: 600;
				line-height: 1;
			}
			.actions {
				display: flex;
				flex: 0 0 auto;
				gap: 0.5rem;
			}
			@media (max-width: 600px) {
				.keys {
					display: none;
				}
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

