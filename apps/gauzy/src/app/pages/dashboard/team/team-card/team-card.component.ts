import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ITeamRow } from '../team-dashboard.utils';

/**
 * The open team's header on the Teams dashboard: badge, name, visibility and
 * prefix, the live line and managers — the team page's own header, with a
 * link to that page.
 */
@Component({
	selector: 'gauzy-team-card',
	templateUrl: './team-card.component.html',
	styleUrls: [
		'../../../employees/view-employee/view-employee.component.scss',
		'../team-dashboard.shared.scss',
		'./team-card.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TeamCardComponent {
	@Input() public team: ITeamRow;
}
