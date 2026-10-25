import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IProjectWorked, formatDuration } from '../team-dashboard.utils';

/**
 * The projects behind a "Projects worked" tile of the Teams dashboard: each
 * project with the time it got on the selected day and how many people worked
 * on it, longest first. Rendered inside an `nbPopover` opened from the tile's
 * View button, with `nbPopoverClass="projects-popover"`.
 */
@Component({
	selector: 'gauzy-team-projects-list',
	templateUrl: './team-projects-list.component.html',
	styleUrls: ['./team-projects-list.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TeamProjectsListComponent {
	@Input() public projects: IProjectWorked[] = [];

	protected readonly formatDuration = formatDuration;
}
