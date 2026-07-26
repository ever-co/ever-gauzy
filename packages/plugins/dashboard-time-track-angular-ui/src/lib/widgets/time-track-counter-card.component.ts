import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CounterPointComponent } from '@gauzy/ui-core/shared';

/**
 * Presentational body shared by the six Time Tracking counter widgets.
 *
 * It renders the inside of the legacy dashboard counter (large value plus the
 * `gauzy-counter-point` strip) and adds the two states a canvas-hosted widget
 * needs but the legacy page never had: a loading skeleton and a recoverable
 * error state.
 *
 * It deliberately renders NO card and NO title: on a canvas every widget is
 * already wrapped by `<ga-dashboard-widget-host>`, which owns the `nb-card`, the
 * header title and the edit-mode menu. Rendering our own would nest a card in a
 * card and print the title twice.
 *
 * Purely presentational on purpose — all fetching lives in
 * `BaseTimeTrackCounterWidgetComponent`, so this component stays trivially
 * reusable by any future counter.
 */
@Component({
	selector: 'gz-time-track-counter-card',
	templateUrl: './time-track-counter-card.component.html',
	styleUrls: ['./time-track-counter-card.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule, CounterPointComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackCounterCardComponent {
	/**
	 * Optional translation key for a muted line under the counter.
	 *
	 * Used by the range-aware counters to say what the number actually covers
	 * ("Worked over the period") when the selected range is not the one the host
	 * header implies. `null` — the default — renders nothing, because repeating
	 * the host's title inside the card is pure noise.
	 */
	readonly captionKey = input<string | null>(null);

	/** Already formatted value shown as the headline figure (`"12"`, `"08:15:00"`, `"64%"`). */
	readonly value = input<string>('');

	/** Raw numeric value driving the counter-point strip. */
	readonly counterValue = input<number>(0);

	/** Denominator for the counter-point strip. `0` falls back to a full day. */
	readonly total = input<number>(0);

	/**
	 * Nebular status name used to colour filled points (`info`, `success`, …).
	 *
	 * A status — not a hex — because `CounterPointComponent` interpolates this
	 * into `var(--color-<value>-default)`, which is what keeps the strip correct
	 * in every theme.
	 */
	readonly color = input<string>('');

	/** Renders a progress bar instead of the point strip (percentage counters). */
	readonly progress = input<boolean>(false);

	/** Shows the skeleton instead of the value. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the card into its error state. */
	readonly error = input<string | null>(null);

	/** Emitted when the user asks for a re-fetch from the error state. */
	readonly retry = output<void>();
}
