import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, Injectable, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbDialogRef, NbDialogService, NbIconModule, NbInputModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IChatConversationWithState, IChatCreateTaskResult, IChatMessageWithRelations, IChatTaskReference, IOrganization, IUser } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { ChatTaskSummary, conversationChoices, sendToChatBody, taskTitleFromBody } from '../chat-tasks';
import { apiErrorMessage, conversationTitle, newNonce } from '../chat-ui.helpers';
import { ChatPeople, ChatPeopleService, EMPTY_PEOPLE } from '../services/chat-people.service';
import { ChatProjectChoice, ChatTasksService } from '../services/chat-tasks.service';
import { ChatUiService } from '../services/chat-ui.service';

const TASK_DIALOG_STYLES = `
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
		.choices {
			max-height: 40vh;
			overflow-y: auto;
			margin: 0.25rem 0 0.75rem;
			padding: 0;
			list-style: none;
		}
		.choice {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			padding: 0.375rem 0.5rem;
			border: 0;
			border-radius: 0.25rem;
			background: transparent;
			color: inherit;
			font-size: 0.875rem;
			text-align: left;
			cursor: pointer;
		}
		.choice:hover,
		.choice.selected {
			background: var(--background-basic-color-2);
		}
		.choice.selected {
			font-weight: 600;
		}
		.task {
			display: flex;
			gap: 0.5rem;
			align-items: baseline;
			margin: 0 0 0.75rem;
			font-size: 0.875rem;
		}
		.task-key {
			font-family: monospace;
			font-size: 0.75rem;
			opacity: 0.7;
		}
		.empty {
			padding: 0.5rem;
			font-size: 0.875rem;
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
			min-height: 5rem;
		}
	`;

/** What the page passes to the create-task dialog. */
export interface CreateTaskDialogContext {
	message: IChatMessageWithRelations;
	people: ChatPeople;
	conversationNames: ReadonlyMap<string, string>;
	organizationId: string | null;
	tenantId: string | null;
}

/**
 * "Create task from message": the title (the message's first line to start with), the project (optional) and the
 * people to assign (optional; the platform assigns the creator too). The task's description is the message, and the
 * message keeps a reference to the task (`POST /chat/messages/:id/create-task`). Closes with the API's answer.
 */
@Component({
	selector: 'ngx-chat-create-task-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbInputModule, NbSelectModule, NbSpinnerModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="create-task-dialog">
			<nb-card-header>{{ 'CHAT.TASKS.CREATE_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="text">{{ 'CHAT.TASKS.CREATE_TEXT' | translate }}</p>
				<label class="field">
					<span>{{ 'CHAT.TASKS.TASK_TITLE' | translate }}</span>
					<input nbInput fullWidth data-test="task-title" [ngModel]="title()" (ngModelChange)="title.set($event)" maxlength="255" autofocus />
				</label>
				<label class="field">
					<span>{{ 'CHAT.TASKS.PROJECT' | translate }}</span>
					<nb-select fullWidth data-test="task-project" [selected]="projectId()" (selectedChange)="projectId.set($event)" [placeholder]="'CHAT.TASKS.NO_PROJECT' | translate">
						<nb-option [value]="null">{{ 'CHAT.TASKS.NO_PROJECT' | translate }}</nb-option>
						@for (project of projects(); track project.id) {
							<nb-option [value]="project.id">{{ project.name }}</nb-option>
						}
					</nb-select>
				</label>
				<label class="field">
					<span>{{ 'CHAT.TASKS.ASSIGNEES' | translate }}</span>
					<nb-select fullWidth multiple data-test="task-assignees" [selected]="assigneeIds()" (selectedChange)="assigneeIds.set($event ?? [])" [placeholder]="'CHAT.TASKS.ASSIGNEES_HINT' | translate">
						@for (person of context.people.list; track person.employeeId) {
							<nb-option [value]="person.employeeId">{{ person.name }}</nb-option>
						}
					</nb-select>
				</label>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" data-test="task-create" [disabled]="!canCreate()" (click)="create()">{{ 'CHAT.TASKS.CREATE' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [TASK_DIALOG_STYLES]
})
export class CreateTaskDialogComponent implements OnInit {
	protected readonly ref = inject<NbDialogRef<CreateTaskDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly tasks = inject(ChatTasksService);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by `NbDialogService.open(…, { context })`. */
	context: CreateTaskDialogContext = { message: null as unknown as IChatMessageWithRelations, people: EMPTY_PEOPLE, conversationNames: new Map(), organizationId: null, tenantId: null };

	protected readonly title = signal('');
	protected readonly projectId = signal<string | null>(null);
	protected readonly assigneeIds = signal<string[]>([]);
	protected readonly projects = signal<ChatProjectChoice[]>([]);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly canCreate = computed(() => !!this.title().trim() && !this.busy());

	ngOnInit(): void {
		this.title.set(taskTitleFromBody(this.context.message?.body ?? '', this.context.people.byEmployee, this.context.conversationNames));
		if (this.context.organizationId) {
			this.tasks
				.projects(this.context.organizationId, this.context.tenantId)
				// Someone who may not list the projects still creates the task, without one.
				.pipe(
					catchError(() => of([] as ChatProjectChoice[])),
					takeUntilDestroyed(this.destroyRef)
				)
				.subscribe((projects) => this.projects.set(projects));
		}
	}

	protected create(): void {
		const title = this.title().trim();
		if (!title || this.busy() || !this.context.message) return;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.createTask(this.context.message.id, {
				title,
				...(this.projectId() ? { projectId: this.projectId() as string } : {}),
				...(this.assigneeIds().length ? { assigneeEmployeeIds: this.assigneeIds() } : {})
			})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result: IChatCreateTaskResult) => {
					this.tasks.remember(result.task);
					this.ref.close(result);
				},
				error: (error) => {
					this.busy.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}
}

/**
 * "Create task from message" for the conversation and the thread alike: the dialog, a toast once the task exists, and
 * the message's new task reference (null when nothing was created). The caller adds it to the message as shown then
 * (`withTaskReference`), not to the message the dialog opened with, which may have changed meanwhile.
 */
@Injectable({ providedIn: 'root' })
export class ChatCreateTaskFlow {
	private readonly dialog = inject(NbDialogService);
	private readonly toastr = inject(ToastrService);

	open(context: CreateTaskDialogContext): Observable<IChatTaskReference | null> {
		return this.dialog.open(CreateTaskDialogComponent, { context: { context } }).onClose.pipe(
			map((result: IChatCreateTaskResult | null | undefined) => {
				if (!result?.task) return null;
				this.toastr.success('CHAT.TASKS.CREATED', { title: result.task.title });
				return result.reference;
			})
		);
	}
}

/** What the "Send to chat" dialog answers: where the task went. */
export interface SendTaskToChatResult {
	conversationId: string;
	title: string;
}

/**
 * "Send to chat" from a task: pick one of my conversations (favourites first, then the most recent), add a note if
 * wished, and the task goes there as a message in my name with the task's card (`taskId` on the send). Closes with
 * the conversation it went to.
 */
@Component({
	selector: 'ngx-chat-send-task-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [FormsModule, NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbSpinnerModule, TranslatePipe],
	template: `
		<nb-card class="dialog" data-test="send-task-dialog">
			<nb-card-header>{{ 'CHAT.TASKS.SEND_TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (summary(); as task) {
					<p class="task" data-test="send-task-summary">
						@if (task.key) {
							<span class="task-key">{{ task.key }}</span>
						}
						<span>{{ task.title }}</span>
					</p>
				}
				<label class="field">
					<span>{{ 'CHAT.TASKS.SEND_TO' | translate }}</span>
					<input nbInput fullWidth data-test="send-task-search" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="'CHAT.TASKS.SEARCH_CONVERSATIONS' | translate" />
				</label>
				@if (loading()) {
					<div class="loading" [nbSpinner]="true"></div>
				} @else if (loadFailed()) {
					<p class="error" role="alert">
						{{ 'CHAT.ERROR' | translate }}
						<button nbButton ghost size="tiny" type="button" data-test="send-task-retry" (click)="load()">{{ 'CHAT.RETRY' | translate }}</button>
					</p>
				} @else {
					<ul class="choices" role="listbox" [attr.aria-label]="'CHAT.TASKS.SEND_TO' | translate">
						@for (conversation of choices(); track conversation.id) {
							<li role="none">
								<button
									type="button"
									class="choice"
									role="option"
									[class.selected]="selectedId() === conversation.id"
									[attr.aria-selected]="selectedId() === conversation.id"
									[attr.data-test]="'send-task-to-' + conversation.id"
									(click)="selectedId.set(conversation.id)"
								>
									<nb-icon [icon]="conversation.kind === 'channel' ? (conversation.visibility === 'private' ? 'lock-outline' : 'hash-outline') : conversation.kind === 'group' ? 'people-outline' : 'person-outline'"></nb-icon>
									<span>{{ titleOf(conversation) }}</span>
								</button>
							</li>
						} @empty {
							<li class="empty" role="none">{{ 'CHAT.TASKS.NO_CONVERSATIONS' | translate }}</li>
						}
					</ul>
				}
				<label class="field">
					<span>{{ 'CHAT.TASKS.NOTE' | translate }}</span>
					<textarea nbInput fullWidth rows="2" data-test="send-task-note" [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="3000"></textarea>
				</label>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
			</nb-card-body>
			<nb-card-footer class="footer">
				<button nbButton ghost type="button" (click)="ref.close(null)">{{ 'CHAT.DIALOG.CANCEL' | translate }}</button>
				<button nbButton status="primary" type="button" data-test="send-task" [disabled]="!canSend()" (click)="send()">{{ 'CHAT.TASKS.SEND' | translate }}</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [TASK_DIALOG_STYLES]
})
export class SendTaskToChatDialogComponent implements OnInit {
	protected readonly ref = inject<NbDialogRef<SendTaskToChatDialogComponent>>(NbDialogRef);
	private readonly api = inject(ChatUiService);
	private readonly tasks = inject(ChatTasksService);
	private readonly peopleService = inject(ChatPeopleService);
	private readonly store = inject(Store);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** Set by `NbDialogService.open(…, { context })`. */
	taskId = '';

	protected readonly conversations = signal<IChatConversationWithState[]>([]);
	protected readonly people = signal<ChatPeople>(EMPTY_PEOPLE);
	protected readonly summary = signal<ChatTaskSummary | null>(null);
	protected readonly query = signal('');
	protected readonly note = signal('');
	protected readonly selectedId = signal<string | null>(null);
	protected readonly loading = signal(true);
	protected readonly loadFailed = signal(false);
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	private meEmployeeId: string | null = null;
	/**
	 * The idempotency key of the last send, with what it sent: a retry of the same message to the same conversation
	 * (the answer lost, the message maybe stored) reuses it, so the platform answers the stored message, not a copy.
	 */
	private attempt: { key: string; nonce: string } | null = null;

	protected readonly choices = computed(() => conversationChoices(this.conversations(), this.query(), (conversation) => this.titleOf(conversation)));
	/** The picked conversation, only while the list shows it: a search that hides it leaves nothing to send to. */
	protected readonly target = computed(() => this.choices().find((conversation) => conversation.id === this.selectedId()) ?? null);
	protected readonly canSend = computed(() => !!this.target() && !this.busy() && !!this.taskId);

	ngOnInit(): void {
		const user = this.store.user as (IUser & { employee?: { id?: string }; employeeId?: string }) | null;
		this.meEmployeeId = user?.employee?.id ? String(user.employee.id) : user?.employeeId ? String(user.employeeId) : null;
		this.load();
	}

	/** My conversations, the people (for their titles) and the task's summary; a failed list offers to try again. */
	protected load(): void {
		const user = this.store.user as (IUser & { employee?: { id?: string }; employeeId?: string }) | null;
		const organization = this.store.selectedOrganization as IOrganization | null;
		const tenantId = organization?.tenantId ?? user?.tenantId ?? null;
		this.loading.set(true);
		this.loadFailed.set(false);
		forkJoin({
			list: this.api.listMine().pipe(catchError(() => of(null))),
			people: organization?.id && tenantId ? this.peopleService.people(organization.id, tenantId) : of(EMPTY_PEOPLE),
			summary: this.taskId ? this.tasks.summary(this.taskId) : of(null)
		})
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(({ list, people, summary }) => {
				this.people.set(people);
				this.summary.set(summary ?? null);
				this.loading.set(false);
				if (!list) {
					this.loadFailed.set(true);
					return;
				}
				this.conversations.set(list.conversations);
			});
	}

	protected titleOf(conversation: IChatConversationWithState): string {
		return conversationTitle(conversation, this.people().byEmployee, this.meEmployeeId, this.translate.instant('CHAT.UNNAMED'));
	}

	protected send(): void {
		const conversation = this.target();
		if (!conversation || this.busy() || !this.taskId) return;
		const conversationId = String(conversation.id);
		const body = sendToChatBody(this.note(), this.summary());
		const key = `${conversationId}|${body}`;
		if (this.attempt?.key !== key) this.attempt = { key, nonce: newNonce() };
		const nonce = this.attempt.nonce;
		this.busy.set(true);
		this.error.set(null);
		this.api
			.send(conversationId, { body, nonce, taskId: this.taskId })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.api.notifyChanged();
					this.ref.close({ conversationId, title: conversation ? this.titleOf(conversation) : '' } satisfies SendTaskToChatResult);
				},
				error: (error) => {
					this.busy.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.DIALOG.FAILED'));
				}
			});
	}
}
