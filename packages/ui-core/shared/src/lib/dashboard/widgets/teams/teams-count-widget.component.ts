import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsCounterCardComponent } from './teams-counter-card.component';

/**
 * Counter widget: how many teams have somebody working, out of all teams in scope.
 *
 * Extracted from the first card of the legacy Teams dashboard
 * (`countWorking / countTeams`).
 */
@Component({
	selector: 'ga-teams-count-widget',
	templateUrl: './teams-count-widget.component.html',
	standalone: true,
	imports: [TeamsCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsCountWidgetComponent extends BaseTeamsWidgetComponent {
	/** Teams with at least one member working in the selected range. */
	protected readonly teamsWorking = computed<number>(() => this.snapshot()?.teamsWorking ?? 0);

	/** Teams in scope — the counter-point denominator. */
	protected readonly teamsTotal = computed<number>(() => this.snapshot()?.teamsTotal ?? 0);
}
