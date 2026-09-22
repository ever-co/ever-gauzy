import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { InfoBlockModule } from '../../info-block/info-block.module';

/**
 * One row inside the accordion body of a Human Resources block.
 *
 * Titles and meta lines are carried as translation KEYS (plus their interpolation
 * parameters) rather than translated strings so the card can render them through
 * the `translate` pipe — which is what keeps the labels correct after a language
 * switch without every widget having to re-run its own translation.
 */
export interface IHrInfoBlockRow {
	/** Stable identity for `@for` tracking. */
	id: string;
	/** Translation key of the row title. */
	titleKey: string;
	/** Translation key of the muted line under the title, if any. */
	metaKey?: string | null;
	/** Interpolation parameters for {@link metaKey}. */
	metaParams?: Record<string, unknown> | null;
	/** Already formatted amount. */
	value: string;
	/** CSS colour applied to the amount (a Nebular custom property). */
	color: string;
	/** History dialog opened when the row is clicked; `null` makes it inert. */
	historyType?: EmployeeStatisticsHistoryEnum | null;
}

/**
 * Presentational shell shared by the nine Human Resources info-block widgets.
 *
 * It wraps — and never re-implements — the existing `ga-info-block`, adding the
 * three states a canvas-hosted widget needs but the legacy Human Resources page
 * never had:
 *
 * - a **loading skeleton**, so the card never flashes a hard `0` that reads as
 *   real data while the request is still in flight;
 * - a recoverable **error state** with a retry button;
 * - an actionable **empty state**, because every figure on this dashboard is
 *   about ONE employee and there is nothing meaningful to show — least of all
 *   zeros — until one is selected.
 *
 * It deliberately renders NO card chrome and NO card header: on a canvas every
 * widget is already wrapped by `<ga-dashboard-widget-host>`, which owns the
 * `nb-card`, the header title and the edit-mode menu. The title passed as
 * {@link titleKey} is the *block's* own label — the left column of
 * `ga-info-block`'s title/value row and the accordion header — not a second card
 * header, which is why it stays the short legacy wording ("Total Income") rather
 * than repeating the host's palette title ("Employee Total Income").
 *
 * Purely presentational on purpose — all fetching lives in
 * `BaseHrInfoWidgetComponent`.
 */
@Component({
	selector: 'ga-hr-info-card',
	templateUrl: './hr-info-card.component.html',
	styleUrls: ['./hr-info-card.component.scss'],
	standalone: true,
	imports: [NbButtonModule, NbIconModule, TranslateModule, InfoBlockModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrInfoCardComponent {
	/** Translation key of the block title. */
	readonly titleKey = input<string>('');

	/** Translation key of the muted explanation under the title. */
	readonly metaKey = input<string | null>(null);

	/** Interpolation parameters for {@link metaKey}. */
	readonly metaParams = input<Record<string, unknown> | null>(null);

	/** Already formatted amount shown as the block's figure. */
	readonly value = input<string>('');

	/**
	 * CSS colour applied to the amount.
	 *
	 * A custom property (`var(--color-success-default)`) rather than a hex, so the
	 * figure stays legible in every theme — see {@link HR_BLOCK_COLORS}.
	 */
	readonly color = input<string>('');

	/** Renders the emphasized variant the legacy page uses for Profit. */
	readonly highlight = input<boolean>(false);

	/** Rows shown in the accordion body; a non-empty list turns on the accordion. */
	readonly rows = input<IHrInfoBlockRow[]>([]);

	/** Shows the skeleton instead of the block. */
	readonly loading = input<boolean>(false);

	/** Non-null switches the card into its error state. */
	readonly error = input<string | null>(null);

	/** False renders the "select an employee" empty state. */
	readonly hasEmployee = input<boolean>(false);

	/**
	 * Translation key of an explanation for why this figure cannot be shown for
	 * the current organization (e.g. a bonus block whose bonus rule is not the
	 * one the organization uses). `null` renders the figure normally.
	 */
	readonly unavailableKey = input<string | null>(null);

	/** The user clicked the block itself. */
	readonly openInfo = output<void>();

	/** The user clicked one of the accordion rows. */
	readonly openRow = output<IHrInfoBlockRow>();

	/** The user asked for a re-fetch from the error state. */
	readonly retry = output<void>();
}
