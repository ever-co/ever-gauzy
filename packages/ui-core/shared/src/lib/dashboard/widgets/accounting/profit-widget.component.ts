import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AccountingStatisticCardComponent } from './accounting-statistic-card.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';

/**
 * KPI widget: profit (income minus expenses) for the selected period.
 *
 * Mirrors the third `<ga-single-statistic>` of the Accounting dashboard page,
 * including the way its colour follows the sign. That page paints a loss in a
 * hard-coded orange; this widget reuses the theme's danger colour instead, so
 * the figure stays legible in all eight Gauzy themes (and in dark mode) rather
 * than being pinned to one hex value.
 */
@Component({
	selector: 'ga-profit-widget',
	templateUrl: './profit-widget.component.html',
	standalone: true,
	imports: [AccountingStatisticCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfitWidgetComponent extends BaseAccountingWidgetComponent {
	/** Raw profit, used for the sign test. */
	protected readonly profitAmount = computed<number>(() => this.total()?.profit ?? 0);

	/** Profit, formatted in the organization's currency. */
	protected readonly profit = computed<string>(() => this.formatCurrency(this.profitAmount()));

	/** Warning colour while in the black, danger colour once in the red. */
	protected readonly profitColor = computed<string>(() =>
		this.profitAmount() >= 0 ? 'var(--color-warning-default)' : 'var(--color-danger-default)'
	);
}
