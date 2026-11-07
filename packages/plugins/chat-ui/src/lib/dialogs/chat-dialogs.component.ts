import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbCheckboxModule, NbDialogRef, NbIconModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { CHAT_GROUP_MAX_MEMBERS, ChatVisibilityEnum, IChatConversationWithState } from '@gauzy/contracts';
import { ChatPerson } from '../chat-ui.helpers';
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
			color: #e4493f;
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
	`;

function messageOf(error: unknown): string | null {
	const body = (error as HttpErrorResponse)?.error;
	const message = body?.message;
	if (Array.isArray(message)) return message.join(' ');
	return typeof message === 'string' && message.trim() ? message : null;
}

/** A new channel: name, topic, private or public. Closes with the conversation. */
@Component({
	selector: 'ngx-chat-new-channel-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="new-channel-dialog">
			<nb-card-header>{{ 'CHAT.DIALOG.NEW_CHANNEL' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="text">{{ 'CHAT.DIALOG.NEW_CHANNEL_TEXT' | translate }}</p>
				<label class="field">
					<span>{{ 'CHAT.DIALOG.CHANNEL_NAME' | translate }}</span>
					<input nbInput fullWidth data-test="channel-name" [(ngModel)]="name" maxlength="80" autofocus />
				</label>
				<label class="field">
					<span>{{ 'CHAT.DIALOG.CHANNEL_TOPIC' | translate }}</span>
					<input nbInput fullWidth data-test="channel-topic" [(ngModel)]="topic" maxlength="250" />
				</label>
				<nb-checkbox data-test="channel-private" [(ngModel)]="isPrivate">{{ 'CHAT.DIALOG.PRIVATE_CHANNEL' | translate }}</nb-checkbox>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" data-test="channel-create" [disabled]="!name.trim() || busy()" (click)="create()">
					{{ 'CHAT.DIALOG.CREATE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [DIALOG_STYLES]
})
export class NewChannelDialogComponent {
	protected readonly ref = inject<NbDialogRef<NewChannelDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	protected name = '';
	protected topic = '';
	protected isPrivate = false;
	readonly busy = signal(false);
	readonly error = signal<string | null>(null);

	protected create(): void {
		const name = this.name.trim().replace(/^#/, '');
		if (!name || this.busy()) return;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.createChannel({
				name,
				topic: this.topic.trim() || null,
				visibility: this.isPrivate ? ChatVisibilityEnum.PRIVATE : ChatVisibilityEnum.PUBLIC
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (answer) => this.ref.close(answer.conversation),
				error: (error) => {
					this.busy.set(false);
					this.error.set(messageOf(error) ?? 'CHAT.DIALOG.FAILED');
				}
			});
	}
}

/** A new direct or group conversation: pick one person, or up to the group limit. Closes with the conversation. */
@Component({
	selector: 'ngx-chat-new-direct-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbCheckboxModule, NbInputModule, TranslatePipe, PersonAvatarComponent],
	template: `
		<nb-card class="dialog" data-test="new-direct-dialog">
			<nb-card-header>{{ 'CHAT.DIALOG.NEW_MESSAGE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="text">{{ 'CHAT.DIALOG.NEW_MESSAGE_TEXT' | translate: { max: max } }}</p>
				<input nbInput fullWidth data-test="people-search" [placeholder]="'CHAT.DIALOG.SEARCH_PEOPLE' | translate" [ngModel]="query()" (ngModelChange)="query.set($event)" autofocus />
				<ul class="people" role="listbox" aria-multiselectable="true">
					@for (person of candidates(); track person.employeeId) {
						<li>
							<label class="person" [class.selected]="selected().has(person.employeeId)">
								<nb-checkbox [checked]="selected().has(person.employeeId)" [disabled]="!selected().has(person.employeeId) && selected().size >= max" (checkedChange)="toggle(person.employeeId, $event)"></nb-checkbox>
								<ngx-chat-person-avatar [person]="person" size="small"></ngx-chat-person-avatar>
								<span>{{ person.name }}</span>
							</label>
						</li>
					} @empty {
						<li class="empty">{{ 'CHAT.DIALOG.NO_PEOPLE' | translate }}</li>
					}
				</ul>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" data-test="direct-start" [disabled]="selected().size === 0 || busy()" (click)="start()">
					{{ 'CHAT.DIALOG.START' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [DIALOG_STYLES]
})
export class NewDirectDialogComponent {
	protected readonly ref = inject<NbDialogRef<NewDirectDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by the opener (dialog context). */
	people: ChatPeople = EMPTY_PEOPLE;
	meEmployeeId: string | null = null;

	protected readonly max = CHAT_GROUP_MAX_MEMBERS - 1;
	readonly query = signal('');
	readonly selected = signal<ReadonlySet<string>>(new Set());
	readonly busy = signal(false);
	readonly error = signal<string | null>(null);

	readonly candidates = computed<ChatPerson[]>(() => {
		const needle = this.query().trim().toLowerCase();
		return this.people.list
			.filter((person) => person.employeeId !== this.meEmployeeId)
			.filter((person) => !needle || person.name.toLowerCase().includes(needle))
			.slice(0, 50);
	});

	protected toggle(employeeId: string, on: boolean): void {
		const next = new Set(this.selected());
		if (on) next.add(employeeId);
		else next.delete(employeeId);
		this.selected.set(next);
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
					this.error.set(messageOf(error) ?? 'CHAT.DIALOG.FAILED');
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
	private readonly destroyRef = inject(DestroyRef);

	readonly channels = signal<IChatConversationWithState[]>([]);
	readonly loading = signal(true);
	readonly busyId = signal<string | null>(null);
	readonly error = signal<string | null>(null);

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
					this.error.set(messageOf(error) ?? 'CHAT.DIALOG.FAILED');
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
					this.error.set(messageOf(error) ?? 'CHAT.DIALOG.FAILED');
				}
			});
	}
}

