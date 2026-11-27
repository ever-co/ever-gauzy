import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

/**
 * The Goals pages' delete confirmation: a warning icon beside the title, the message under it, and Cancel /
 * Delete on the trailing edge. Cancel comes first so it takes the dialog's initial focus. Closes with `'yes'`
 * or `'no'`, like the shared alert dialog it stands in for.
 */
@Component({
	selector: 'ga-goal-delete-confirm',
	templateUrl: './delete-confirm.component.html',
	styleUrls: ['./delete-confirm.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbCardModule, NbButtonModule, NbIconModule, TranslatePipe]
})
export class GoalDeleteConfirmComponent {
	@Input() data: { title?: string; message?: string };

	readonly titleId = `ga-goal-delete-confirm-title-${++nextId}`;
	readonly messageId = `ga-goal-delete-confirm-message-${nextId}`;

	private readonly dialogRef = inject<NbDialogRef<GoalDeleteConfirmComponent>>(NbDialogRef);

	close(answer: 'yes' | 'no'): void {
		this.dialogRef.close(answer);
	}
}
