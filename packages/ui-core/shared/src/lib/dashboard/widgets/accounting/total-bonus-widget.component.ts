import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AccountingStatisticCardComponent } from './accounting-statistic-card.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';

/** Hint shown when the organization runs no bonus scheme at all. */
const BONUS_NOT_CONFIGURED = 'DASHBOARD_PAGE.BUILDER.WIDGETS.ACCOUNTING_TOTAL_BONUS.NOT_CONFIGURED';

/**
 * KPI widget: total bonus paid across the organization in the selected period.
 *
 * Mirrors the fourth `<ga-single-statistic>` of the Accounting dashboard page,
 * which renders it in the `highlight` variant (the statistic component paints
 * that in the theme's success colour and ignores the `color` input entirely).
 *
 * The page hides this KPI outright when the organization declares no
 * `bonusType`. A canvas widget cannot silently vanish — the user placed it
 * deliberately — so it explains itself instead of showing a permanent zero.
 */
@Component({
	selector: 'ga-total-bonus-widget',
	templateUrl: './total-bonus-widget.component.html',
	standalone: true,
	imports: [AccountingStatisticCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TotalBonusWidgetComponent extends BaseAccountingWidgetComponent {
	/** Total bonus, formatted in the organization's currency. */
	protected readonly bonus = computed<string>(() => this.formatCurrency(this.total()?.bonus ?? 0));

	/** Translation key of the "no bonus scheme" hint, or `null` when the figure applies. */
	protected readonly unavailableKey = computed<string | null>(() =>
		this.hasBonusType() ? null : BONUS_NOT_CONFIGURED
	);
}
