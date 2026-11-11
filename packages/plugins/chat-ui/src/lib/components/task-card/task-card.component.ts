import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
		<span class="task-card" data-test="task-card" [class.busy]="saving()">
			<a class="task-link" [routerLink]="link()">
				<nb-icon icon="checkmark-square-2-outline"></nb-icon>
				@if (summary(); as task) {
					@if (task.key) {
						<span class="task-id">{{ task.key }}</span>
					}
					<span class="task-title">{{ task.title }}</span>
				} @else {
					<span>{{ 'CHAT.MESSAGE.TASK' | translate }}</span>
					<span class="task-id">{{ taskId() }}</span>
				}
			</a>
			@if (summary(); as task) {
				@if (canEdit()) {
					<select
						class="task-select"
						data-test="task-status"
						[attr.aria-label]="'CHAT.TASKS.STATUS' | translate"
						[disabled]="saving()"
						(change)="pickStatus($any($event.target).value)"
					>
						@if (!task.status) {
							<option value="" selected>{{ 'CHAT.TASKS.NO_STATUS' | translate }}</option>
						}
						@for (choice of statuses(); track choice.name) {
							<option [value]="choice.name" [selected]="choice.name === task.status">{{ choice.name }}</option>
						}
					</select>
					<select
						class="task-select"
						data-test="task-priority"
						[attr.aria-label]="'CHAT.TASKS.PRIORITY' | translate"
						[disabled]="saving()"
						(change)="pickPriority($any($event.target).value)"
					>
						<option value="" [selected]="!task.priority">{{ 'CHAT.TASKS.NO_PRIORITY' | translate }}</option>
						@for (priority of priorities(); track priority) {
							<option [value]="priority" [selected]="priority === task.priority">{{ priority }}</option>
						}
					</select>
					<select
						class="task-select"
						data-test="task-assignee"
						[attr.aria-label]="'CHAT.TASKS.ASSIGN' | translate"
						[disabled]="saving()"
						(change)="toggleAssignee($any($event.target))"
					>
						<option value="" selected>{{ 'CHAT.TASKS.ASSIGNED' | translate: { count: task.assigneeIds?.length ?? 0 } }}</option>
						@for (person of people().list; track person.employeeId) {
							<option [value]="person.employeeId">{{ isAssigned(person.employeeId) ? '✓ ' : '' }}{{ person.name }}</option>
						}
					</select>
				} @else if (task.status) {
					<span class="task-status">{{ task.status }}</span>
				}
			}
			@if (error(); as message) {
				<span class="task-error" role="alert" data-test="task-error">{{ message }}</span>
			}
		</span>
	`,
	styles: [
		`
			:host {
				display: inline-block;
				max-width: 100%;
			}
			.task-card {
				display: inline-flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
				margin: 0.25rem 0.25rem 0 0;
				padding: 0.25rem 0.5rem;
				border: 1px solid rgba(127, 127, 127, 0.3);
				border-radius: 0.375rem;
				font-size: 0.8125rem;
			}
			.task-card.busy {
				opacity: 0.7;
			}
			.task-link {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				min-width: 0;
				color: inherit;
				text-decoration: none;
			}
			.task-id {
				font-family: monospace;
				font-size: 0.6875rem;
				opacity: 0.7;
			}
			.task-title {
				max-width: 24rem;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
			.task-status {
				padding: 0 0.375rem;
				border-radius: 999px;
				background: var(--background-basic-color-3);
				font-size: 0.6875rem;
			}
			.task-select {
				max-width: 9rem;
				padding: 0 0.25rem;
				border: 1px solid rgba(127, 127, 127, 0.3);
				border-radius: 0.25rem;
				background: transparent;
				color: inherit;
				font-size: 0.6875rem;
			}
			.task-error {
				font-size: 0.6875rem;
				color: var(--color-danger-default, #d33);
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
				next: (result) => {
					this.saving.set(false);
					// The answer's task may come without its relations: read the summary again to show it as stored.
					if (result?.task) this.tasks.remember(result.task);
					this.tasks.refresh([this.taskId()]);
				},
				error: (error) => {
					this.saving.set(false);
					this.error.set(apiErrorMessage(error) ?? this.translate.instant('CHAT.TASKS.CHANGE_FAILED'));
					this.tasks.refresh([this.taskId()]);
				}
			});
	}
}
