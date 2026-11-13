import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NbButtonModule, NbDialogService, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ToastrService } from '@gauzy/ui-core/core';
import { SendTaskToChatDialogComponent, SendTaskToChatResult } from '../../dialogs/chat-task-dialogs.component';
import { ChatAvailabilityService } from '../../services/chat-availability.service';

/** The route parameter the task's own page carries the task id in (`/pages/tasks/view/:id`). */
export const TASK_VIEW_ID_PARAM = 'id';

/**
 * "Send to chat" on a task's page (the `task-view-actions` extension slot): opens the conversation picker and posts
 * the task's card there in my name; the page stays where it is. Shown only where the API serves the chat to the
 * signed-in user; the task is the one of the page's route.
 */
@Component({
	selector: 'ngx-chat-send-task-button',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbIconModule, NbTooltipModule, TranslatePipe],
	template: `
		@if (available() && taskId()) {
			<button
				nbButton
				ghost
				size="tiny"
				status="basic"
				type="button"
				data-test="send-task-to-chat"
				[nbTooltip]="'CHAT.TASKS.SEND_TITLE' | translate"
				nbTooltipPlacement="top"
				[attr.aria-label]="'CHAT.TASKS.SEND_TITLE' | translate"
				(click)="open()"
			>
				<nb-icon icon="message-circle-outline"></nb-icon>
			</button>
		}
	`
})
export class SendTaskButtonComponent {
	private readonly dialog = inject(NbDialogService);
	private readonly toastr = inject(ToastrService);
	private readonly destroyRef = inject(DestroyRef);

	protected readonly available = toSignal(inject(ChatAvailabilityService).available$, { initialValue: false });
	protected readonly taskId = toSignal(
		inject(ActivatedRoute).paramMap.pipe(
			map((params) => params.get(TASK_VIEW_ID_PARAM)),
			distinctUntilChanged()
		),
		{ initialValue: null }
	);

	protected open(): void {
		const taskId = this.taskId();
		if (!taskId) return;
		this.dialog
			.open(SendTaskToChatDialogComponent, { context: { taskId } })
			.onClose.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((result: SendTaskToChatResult | null | undefined) => {
				if (!result?.conversationId) return;
				this.toastr.success('CHAT.TASKS.SENT', { name: result.title });
			});
	}
}
