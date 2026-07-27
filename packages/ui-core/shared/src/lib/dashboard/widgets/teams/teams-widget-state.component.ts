import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Loading / error / empty wrapper shared by the list-shaped Teams widgets.
 *
 * The counter widgets get those three states from `ga-teams-counter-card`; the
 * team-card grid, the member list and the status chart need the same states
 * around arbitrary projected content, which is what this component provides.
 *
 * It renders no card: `ga-dashboard-widget-host` already owns the `nb-card`,
 * the header and the edit-mode menu.
 */
@Component({
	selector: 'ga-teams-widget-state',
	templateUrl: './teams-widget-state.component.html',
	styleUrls: ['./teams-widget-state.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsWidgetStateComponent {
	/** Shows the skeleton rows instead of the content. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the wrapper into its error state. */
	readonly error = input<string | null>(null);

	/** True when the (successfully loaded) content has nothing to show. */
	readonly empty = input<boolean>(false);

	/** Translation key of the message rendered in the empty state. */
	readonly emptyMessageKey = input<string>('SM_TABLE.NO_DATA.TEAM_DASHBOARD');

	/** How many skeleton rows to render while loading. */
	readonly skeletonRows = input<number>(3);

	/** Emitted when the user asks for a re-fetch from the error state. */
	readonly retry = output<void>();

	/**
	 * Range the template repeats the skeleton rows over.
	 *
	 * A `computed` rather than a getter: `@for` needs an iterable, and a getter
	 * would allocate a fresh array on every change-detection pass — which also
	 * makes the `track` identity churn.
	 */
	protected readonly skeletonRange = computed<number[]>(() => {
		const rows = Math.max(1, Math.min(this.skeletonRows(), 10));
		return Array.from({ length: rows }, (_, index: number) => index);
	});
}
