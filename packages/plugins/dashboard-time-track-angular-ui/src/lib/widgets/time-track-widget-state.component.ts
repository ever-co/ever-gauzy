import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Loading / error / empty wrapper shared by the list-shaped Time Tracking widgets.
 *
 * The six counter widgets get those states from `gz-time-track-counter-card`;
 * the five "window" panels (Manual Time, Tasks, Projects, Apps & URLs, Members)
 * need the same three states around arbitrary projected content, which is what
 * this component provides.
 *
 * It renders NO card: on a canvas every widget is already wrapped by
 * `<ga-dashboard-widget-host>`, which owns the `nb-card`, the header title and
 * the edit-mode menu — rendering our own would nest a card in a card.
 *
 * NOTE: `ga-teams-widget-state` in `@gauzy/ui-core/shared` does the same job for
 * the Teams widgets, but it is deliberately NOT part of that package's public
 * API (the dashboard widgets barrel exports only the registration arrays, so
 * widget components never reach the root bundle). A plugin therefore cannot
 * import it, exactly as this plugin already owns its own counter card.
 */
@Component({
	selector: 'gz-time-track-widget-state',
	templateUrl: './time-track-widget-state.component.html',
	styleUrls: ['./time-track-widget-state.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackWidgetStateComponent {
	/** Shows the skeleton rows instead of the projected content. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the wrapper into its error state. */
	readonly error = input<string | null>(null);

	/** True when the (successfully loaded) content has nothing to show. */
	readonly empty = input<boolean>(false);

	/**
	 * Translation key of the message rendered in the empty state.
	 *
	 * The panels pass a RANGE-AWARE key ("No manual time for the day" vs "…over
	 * the period"), which is what the legacy dashboard did through a `@switch`.
	 */
	readonly emptyMessageKey = input<string>('SM_TABLE.NO_DATA_MESSAGE');

	/** How many skeleton rows to render while loading. */
	readonly skeletonRows = input<number>(4);

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
