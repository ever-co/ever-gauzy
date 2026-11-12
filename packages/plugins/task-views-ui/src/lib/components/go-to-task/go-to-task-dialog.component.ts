import { AfterViewInit, ChangeDetectionStrategy, Component, inject, ViewChild } from '@angular/core';
import { NbButtonModule, NbCardModule, NbDialogRef } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { GoToTaskBoxComponent } from './go-to-task-box.component';

/** The go-to box in a dialog, for the `G R` shortcut: closes once the task opened. */
@Component({
	selector: 'ngx-task-views-go-to-dialog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, NbCardModule, TranslatePipe, GoToTaskBoxComponent],
	template: `
		<nb-card class="go-to-dialog" data-test="go-to-dialog">
			<nb-card-header>{{ 'TASK_VIEWS.GOTO.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="hint">{{ 'TASK_VIEWS.GOTO.HINT' | translate }}</p>
				<ngx-task-views-go-to-box size="medium" (opened)="close()"></ngx-task-views-go-to-box>
			</nb-card-body>
			<nb-card-footer class="actions">
				<button nbButton status="basic" type="button" (click)="close()">
					{{ 'TASK_VIEWS.DIALOG.CANCEL' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`,
	styles: [
		`
			.go-to-dialog {
				width: min(26rem, 92vw);
			}
			.hint {
				margin: 0 0 0.75rem;
				color: var(--text-hint-color);
			}
			.actions {
				display: flex;
				justify-content: flex-end;
			}
		`
	]
})
export class GoToTaskDialogComponent implements AfterViewInit {
	private readonly ref = inject(NbDialogRef) as NbDialogRef<GoToTaskDialogComponent>;

	@ViewChild(GoToTaskBoxComponent) private box?: GoToTaskBoxComponent;

	ngAfterViewInit(): void {
		setTimeout(() => this.box?.focus());
	}

	protected close(): void {
		this.ref.close();
	}
}
