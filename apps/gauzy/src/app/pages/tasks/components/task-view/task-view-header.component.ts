import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ITask } from '@gauzy/contracts';
import { IRecordViewStatus } from '@gauzy/ui-core/shared';

/**
 * A task's issue-style header — project / key breadcrumb, the title, and the status lozenge — projected
 * into `ngx-record-view` (as `recordViewHeader`) by both task View surfaces: the list drawer and the
 * full-width task page.
 */
@Component({
	selector: 'ga-task-view-header',
	templateUrl: './task-view-header.component.html',
	styleUrls: ['./task-view-header.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TaskViewHeaderComponent {
	@Input() task: ITask;
	@Input() status: IRecordViewStatus;
	/** The page shows the title as its main heading; the drawer keeps the softer size. */
	@Input() large = false;
}
