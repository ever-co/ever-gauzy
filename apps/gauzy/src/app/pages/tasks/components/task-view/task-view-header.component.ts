import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NbIconModule } from '@nebular/theme';
import { ITask } from '@gauzy/contracts';
import { HashNumberPipe, IRecordViewStatus } from '@gauzy/ui-core/shared';

/**
 * A task's issue-style header — project / key breadcrumb, the title, and the status lozenge — projected
 * into `ngx-record-view` (as `recordViewHeader`) by both task View surfaces: the list drawer and the
 * full-width task page — and by the Team page's task drawer, hence standalone.
 */
@Component({
	selector: 'ga-task-view-header',
	templateUrl: './task-view-header.component.html',
	styleUrls: ['./task-view-header.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: true,
	imports: [NgTemplateOutlet, RouterLink, NbIconModule, HashNumberPipe]
})
export class TaskViewHeaderComponent {
	@Input() task: ITask;
	@Input() status: IRecordViewStatus;
	/** Where the breadcrumb's project leads, for a viewer who may open it; without one it is plain text. */
	@Input() projectLink: string[] | null = null;
}
