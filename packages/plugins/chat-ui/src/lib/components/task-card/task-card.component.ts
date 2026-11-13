import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IChatTaskUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { CHAT_TASK_PRIORITIES, ChatTaskStatusChoice, ChatTaskSummary, toggledAssignees } from '../../chat-tasks';
import { CHAT_TASK_LINK } from '../../chat-ui.constants';
import { apiErrorMessage } from '../../chat-ui.helpers';
import { ChatPeople } from '../../services/chat-people.service';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatUiService } from '../../services/chat-ui.service';

/**
 * A task card in a message: the task's key, title and status, a link to the task, and — for a reader who may change
 * tasks (`ORG_TASK_EDIT`) in a conversation they can write in — its status, priority and assignees, changed in place
 * through the platform's task update (`PATCH /chat/messages/:id/tasks/:taskId`: the task page's permission and
 * activity log). The card shows the task as the platform answers it; the other members' cards read it again when the
 * message's change reaches them.
 */
@Component({
	selector: 'ngx-chat-task-card',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, NbIconModule, TranslatePipe],
	template: `
		<div class="task-card" data-test="task-card" [class.busy]="held()">
			<a class="task-main" [routerLink]="link()" [attr.title]="'CHAT.MESSAGE.OPEN_TASK' | translate">
				<span class="task-icon"><nb-icon icon="checkmark-square-2-outline"></nb-icon></span>
				<span class="task-text">
					@if (summary(); as task) {
						<strong class="task-title">{{ task.title }}</strong>
						@if (task.key || (task.status && !canEdit())) {
							<span class="task-meta">
								@if (task.key) {
									<span class="task-id">{{ task.key }}</span>
								}
								@if (task.status && !canEdit()) {
									<span class="task-status">{{ task.status }}</span>
								}
							</span>
						}
					} @else {
						<strong>{{ 'CHAT.MESSAGE.TASK' | translate }}</strong>
						<span class="task-id">{{ taskId() }}</span>
					}
				</span>
				<nb-icon class="task-go" icon="arrow-ios-forward-outline"></nb-icon>
			</a>
			@if (canEdit() && summary(); as task) {
				<span class="task-edit">
					<select
						#statusSelect
						class="task-select"
						data-test="task-status"
						[attr.aria-label]="'CHAT.TASKS.STATUS' | translate"
						[disabled]="held()"
						(change)="pickStatus(statusSelect.value)"
					>
						@if (!task.status) {
							<option value="" selected>{{ 'CHAT.TASKS.NO_STATUS' | translate }}</option>
						}
						@for (choice of statuses(); track choice.name) {
							<option [value]="choice.name" [selected]="choice.name === task.status">{{ choice.name }}</option>
						}
						@if (task.status && !hasStatus(task.status)) {
							<option [value]="task.status" selected>{{ task.status }}</option>
						}
					</select>
					<select
						#prioritySelect
						class="task-select"
						data-test="task-priority"
						[attr.aria-label]="'CHAT.TASKS.PRIORITY' | translate"
						[disabled]="held()"
						(change)="pickPriority(prioritySelect.value)"
					>
						<option value="" [selected]="!task.priority">{{ 'CHAT.TASKS.NO_PRIORITY' | translate }}</option>
						@for (priority of priorities(); track priority) {
							<option [value]="priority" [selected]="priority === task.priority">{{ priority }}</option>
						}
					</select>
					<select
						#assigneeSelect
						class="task-select"
						data-test="task-assignee"
						[attr.aria-label]="'CHAT.TASKS.ASSIGN' | translate"
						[disabled]="held()"
						(change)="toggleAssignee(assigneeSelect)"
					>
						<option value="" selected>{{ 'CHAT.TASKS.ASSIGNED' | translate: { count: task.assigneeIds?.length ?? 0 } }}</option>
						@for (person of people().list; track person.employeeId) {
							<option [value]="person.employeeId">{{ isAssigned(person.employeeId) ? '✓ ' : '' }}{{ person.name }}</option>
						}
					</select>
				</span>
			}
			@if (error(); as message) {
				<span class="task-error" role="alert" data-test="task-error">{{ message }}</span>
			}
			@if (unsynced() && !saving()) {
				<span class="task-error" role="alert" data-test="task-unsynced">
					{{ 'CHAT.TASKS.READ_FAILED' | translate }}
					<button type="button" class="task-retry" data-test="task-retry" (click)="retryRead()">{{ 'CHAT.RETRY' | translate }}</button>
				</span>
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: inline-block;
				max-width: 100%;
			}
			.task-card {
				display: inline-flex;
				flex-direction: column;
				gap: 0.375rem;
				min-width: 14rem;
				max-width: 100%;
				padding: 0.5rem 0.625rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.3));
				border-left: 4px solid var(--chat-accent, #3366ff);
				border-radius: var(--border-radius);
				background: var(--chat-bg, transparent);
				transition: border-color 0.12s ease, background-color 0.12s ease;
			}
			.task-card:hover {
				background: var(--chat-hover, rgba(127, 127, 127, 0.08));
			}
			.task-card.busy {
				opacity: 0.7;
			}
			.task-main {
				display: flex;
				align-items: center;
				gap: 0.625rem;
				min-width: 0;
				color: inherit;
				text-decoration: none;
			}
			.task-main:hover {
				text-decoration: none;
			}
			.task-icon {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border-radius: var(--border-radius);
				background: var(--chat-accent-soft, rgba(51, 102, 255, 0.12));
				color: var(--chat-accent, #3366ff);
			}
			.task-text {
				display: flex;
				flex-direction: column;
				flex: 1 1 auto;
				min-width: 0;
				font-size: 0.75rem;
			}
			.task-title {
				max-width: 24rem;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.task-meta {
				display: flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
			}
			.task-id {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				color: var(--chat-muted, inherit);
				font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
				font-size: 0.6875rem;
			}
			.task-status {
				padding: 0 0.375rem;
				border-radius: 999px;
				background: var(--chat-hover, var(--background-basic-color-3));
				color: var(--chat-muted, inherit);
				font-size: 0.6875rem;
			}
			.task-go {
				flex: 0 0 auto;
				color: var(--chat-muted, inherit);
			}
			.task-edit {
				display: flex;
				flex-wrap: wrap;
				gap: 0.375rem;
				padding-left: 2.625rem;
			}
			.task-select {
				max-width: 9rem;
				padding: 0.125rem 0.25rem;
				border: 1px solid var(--chat-border, rgba(127, 127, 127, 0.3));
				border-radius: var(--border-radius);
				background: transparent;
				color: inherit;
				font-size: 0.6875rem;
			}
			.task-error {
				padding-left: 2.625rem;
				font-size: 0.6875rem;
				color: var(--color-danger-default, #d33);
			}
			.task-retry {
				margin-left: 0.25rem;
				padding: 0;
				border: 0;
				background: none;
				color: inherit;
				font: inherit;
				text-decoration: underline;
				cursor: pointer;
			}
		`
	]
})
export class TaskCardComponent {
	private readonly api = inject(ChatUiService);
	private readonly tasks = inject(ChatTasksService);
	private readonly store = inject(Store);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);

	/** The message that shows the task (the change goes through it). */
	readonly messageId = input.required<string>();
	readonly taskId = input.required<string>();
	/** The task's summary; null for a task the reader may not see, undefined while it is read. */
	readonly summary = input<ChatTaskSummary | null | undefined>(undefined);
	readonly people = input.required<ChatPeople>();
	/** Whether the reader may write in the conversation (a member, not archived, the message not deleted). */
	readonly editable = input(false);

	protected readonly statuses = signal<ChatTaskStatusChoice[]>([]);
	protected readonly priorities = computed(() => {
		const current = this.summary()?.priority;
		return current && !CHAT_TASK_PRIORITIES.includes(current) ? [current, ...CHAT_TASK_PRIORITIES] : [...CHAT_TASK_PRIORITIES];
	});
	protected readonly saving = signal(false);
	/**
	 * The card changed the task but could not read it again: what it holds may be older than what is stored, so it takes
	 * no change (an assignee pick sends the whole list) until a read succeeds.
	 */
	protected readonly unsynced = signal(false);
	/** Whether the controls are held still: a change on its way, or a card that could not read its task again. */
	protected readonly held = computed(() => this.saving() || this.unsynced());
	protected readonly error = signal<string | null>(null);
	/** The task page's permission (the API checks it too). */
	protected readonly canEdit = computed(
		() => this.editable() && !!this.summary() && (this.store.hasPermission(PermissionsEnum.ORG_TASK_EDIT) || this.store.hasPermission(PermissionsEnum.ALL_ORG_EDIT))
	);

	constructor() {
		// The statuses of the task's project, read once per project for the page (shared by its cards).
		effect((onCleanup) => {
			const task = this.summary();
			if (!task || !this.canEdit()) return;
			const read = this.tasks
				.statusChoices(task)
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe((choices) => this.statuses.set(choices));
			onCleanup(() => read.unsubscribe());
		});
	}

	protected link(): string {
		return `${CHAT_TASK_LINK}/${encodeURIComponent(this.taskId())}`;
	}

	/** Whether the status list offers the task's status (a status the project no longer lists is still shown). */
	protected hasStatus(name: string): boolean {
		return this.statuses().some((choice) => choice.name === name);
	}

	protected isAssigned(employeeId: string): boolean {
		return (this.summary()?.assigneeIds ?? []).includes(String(employeeId));
	}

	protected pickStatus(name: string): void {
		const task = this.summary();
		if (!task || !name || name === task.status) return;
		const choice = this.statuses().find((item) => item.name === name);
		this.save({ status: name, taskStatusId: choice?.id ?? null });
	}

	protected pickPriority(value: string): void {
		const task = this.summary();
		if (!task || (value || null) === (task.priority ?? null)) return;
		this.save({ priority: value || null });
	}

	protected toggleAssignee(select: HTMLSelectElement): void {
		const employeeId = select.value;
		// The first option only says how many are assigned: the list goes back to it after each pick.
		select.value = '';
		if (!employeeId) return;
		this.save({ assigneeEmployeeIds: toggledAssignees(this.summary()?.assigneeIds, employeeId) });
	}

	private save(input: IChatTaskUpdateInput): void {
		this.saving.set(true);
		this.error.set(null);
		this.api
			.updateTask(this.messageId(), this.taskId(), input)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				// The answer's task may come without its relations (no members after a status change): the card keeps its
				// full summary, reads the task again, and takes no other change before that read ends (an assignee pick
				// sends the whole list, which must be the stored one).
				next: () => this.readAgain(),
				error: (error) => {
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.TASKS.CHANGE_FAILED'));
					this.readAgain();
				}
			});
	}

	protected retryRead(): void {
		this.saving.set(true);
		this.readAgain();
	}

	/**
	 * Reads the task again, the controls held still until the read ends. Once it answers, the summary in place is at least
	 * as new as the change (the store keeps a read's answer unless a later read's is there); a failed read keeps the
	 * controls held, and offers to read again.
	 */
	private readAgain(): void {
		this.tasks
			.reload(this.taskId())
			.pipe(
				finalize(() => this.saving.set(false)),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe({
				next: (summary) => this.unsynced.set(summary === undefined),
				error: () => this.unsynced.set(true)
			});
	}
}
