import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';

/**
 * The Project Management dashboard's "Inbox" panel.
 *
 * The panel is a placeholder on the legacy page too — it renders `ga-wip`
 * ("coming soon") and has no data source — so this widget is the same promise in
 * widget form, and it says so both in the card and in the palette description.
 *
 * It reuses `ga-teams-widget-state`'s empty state rather than `ga-wip` itself:
 * `ga-wip` is only declared by `WorkInProgressModule`, and that module also
 * contributes a multi-provided `ROUTES` entry (a `path: ''` route). Importing it
 * into a standalone widget would inject that route into the injector the widget
 * is created in — a routing side effect a dashboard card has no business having.
 *
 * It fetches nothing, so it opts out of the base class' context-driven refresh.
 */
@Component({
	selector: 'ga-pm-inbox-widget',
	templateUrl: './inbox-widget.component.html',
	styleUrls: ['./inbox-widget.component.scss'],
	standalone: true,
	imports: [TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxWidgetComponent extends BaseDashboardWidgetComponent {
	/** Nothing to fetch, so the ambient context is irrelevant. */
	protected override readonly refreshOnContextChange = false;
}
