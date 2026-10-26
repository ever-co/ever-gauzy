import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IProjectWorked, formatDuration } from '../team-dashboard.utils';

/**
 * The projects behind a "Projects worked" tile of the Teams dashboard: each
 * project with the time it got on the selected day and how many people worked
 * on it, longest first. Rendered inside an `nbPopover` opened from the tile's
 * View button, with `nbPopoverClass="gz-projects-popover"`.
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
	/** How tall the list may grow where it opened (see `fitProjectsPopover`); it scrolls inside. */
	@Input() public maxHeight = 352;
	/** How wide it may grow where it opened: the room left of the button, at most 20rem. */
	@Input() public maxWidth = 320;

	protected readonly formatDuration = formatDuration;
}
