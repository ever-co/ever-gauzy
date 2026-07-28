import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ITask } from '@gauzy/contracts';
import { TableComponentsModule } from '../../../table-components/table-components.module';
import { TeamsWidgetStateComponent } from '../teams/teams-widget-state.component';
import { BaseProjectManagementWidgetComponent } from './base-project-management-widget.component';

/**
 * The Project Management dashboard's "Recently Assigned" panel.
 *
 * Same rows as the panel — the open tasks of the fetched page with their tag
 * chips, rendered by the very same `ga-only-tags` cell component — and the same
 * order (see `openTasksMostRecentFirst`).
 *
 * One difference from the legacy page, which only renders this panel while an
 * employee is selected: a widget the user deliberately placed must not vanish
 * because a header selector was cleared. With no employee in scope it shows the
 * organization's open tasks, which is the same query one scope wider.
 */
@Component({
	selector: 'ga-pm-recently-assigned-widget',
	templateUrl: './recently-assigned-widget.component.html',
	styleUrls: ['./project-management-list-widget.shared.scss', './recently-assigned-widget.component.scss'],
	standalone: true,
	imports: [TableComponentsModule, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentlyAssignedWidgetComponent extends BaseProjectManagementWidgetComponent {
	/** Open tasks of the fetched page, in the legacy panel's order. */
	protected readonly assigned = computed<ITask[]>(() => this.snapshot()?.assigned ?? []);
}
