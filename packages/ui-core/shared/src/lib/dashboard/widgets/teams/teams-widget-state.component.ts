import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

/** Rows rendered while loading when the host asks for no (or a nonsensical) count. */
const DEFAULT_SKELETON_ROWS = 3;

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
	readonly skeletonRows = input<number>(DEFAULT_SKELETON_ROWS);

	/** Emitted when the user asks for a re-fetch from the error state. */
	readonly retry = output<void>();

	/**
	 * Range the template repeats the skeleton rows over.
	 *
	 * A `computed` rather than a getter: `@for` needs an iterable, and a getter
	 * would allocate a fresh array on every change-detection pass — which also
	 * makes the `track` identity churn.
	 *
	 * Non-finite input falls back to the default INSTEAD of being clamped, because
	 * clamping cannot catch it: every comparison with `NaN` is false, so `NaN`
	 * survives `Math.max`/`Math.min` unchanged and `Array.from({ length: NaN })`
	 * yields an EMPTY array — a blank card where the loading state should be.
	 */
	protected readonly skeletonRange = computed<number[]>(() => {
		const requested = this.skeletonRows();
		const rows = Number.isFinite(requested)
			? Math.max(1, Math.min(Math.trunc(requested), 10))
			: DEFAULT_SKELETON_ROWS;

		return Array.from({ length: rows }, (_, index: number) => index);
	});
}
