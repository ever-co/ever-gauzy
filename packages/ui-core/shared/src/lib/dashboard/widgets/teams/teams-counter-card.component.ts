import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CounterPointComponent } from '../../../counter-point/counter-point.component';

/**
 * Presentational body shared by the four Teams counter widgets.
 *
 * It renders the inside of the legacy Teams dashboard counter (large value, an
 * optional "/total" suffix and the `gauzy-counter-point` strip) and adds the two
 * states a canvas-hosted widget needs but the legacy page never had: a loading
 * skeleton and a recoverable error state.
 *
 * It deliberately renders NO card and NO title: on a canvas every widget is
 * already wrapped by `<ga-dashboard-widget-host>`, which owns the `nb-card`, the
 * header title and the edit-mode menu. Rendering our own would nest a card in a
 * card and print the title twice.
 *
 * Purely presentational on purpose — all fetching lives in
 * `BaseTeamsWidgetComponent`, so this component stays reusable by any future
 * Teams counter.
 */
@Component({
	selector: 'ga-teams-counter-card',
	templateUrl: './teams-counter-card.component.html',
	styleUrls: ['./teams-counter-card.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule, CounterPointComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsCounterCardComponent {
	/** Already formatted headline figure (`"7"`, `"64"`). */
	readonly value = input<string>('');

	/**
	 * Muted text rendered right after the value (`"/12"`, `"%"`).
	 *
	 * Mirrors the legacy card, where the denominator is deliberately smaller than
	 * the number it qualifies. `null` renders nothing.
	 */
	readonly suffix = input<string | null>(null);

	/** Raw numeric value driving the counter-point strip. */
	readonly counterValue = input<number>(0);

	/** Denominator for the counter-point strip. `0` falls back to a full day. */
	readonly total = input<number>(0);

	/**
	 * Nebular status name used to colour filled points (`info`, `success`, …).
	 *
	 * A status — not a hex — because `CounterPointComponent` interpolates this
	 * into `var(--color-<value>-default)`, which is what keeps the strip correct
	 * in every theme. The empty default reproduces the legacy card, where the
	 * colour is derived from how full the strip is.
	 */
	readonly color = input<string>('');

	/** Renders a progress bar instead of the point strip (percentage counters). */
	readonly progress = input<boolean>(false);

	/** Optional translation key for a muted line under the counter. */
	readonly captionKey = input<string | null>(null);

	/** Shows the skeleton instead of the value. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the card into its error state. */
	readonly error = input<string | null>(null);

	/** Emitted when the user asks for a re-fetch from the error state. */
	readonly retry = output<void>();
}
