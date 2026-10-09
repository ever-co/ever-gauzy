import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AccountingStatisticCardComponent } from './accounting-statistic-card.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';

/**
 * KPI widget: total income booked across the organization in the selected period.
 *
 * Mirrors the first `<ga-single-statistic>` of the Accounting dashboard page,
 * down to its info colour.
 */
@Component({
	selector: 'ga-total-income-widget',
	templateUrl: './total-income-widget.component.html',
	standalone: true,
	imports: [AccountingStatisticCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TotalIncomeWidgetComponent extends BaseAccountingWidgetComponent {
	/** Total income, formatted in the organization's currency. */
	protected readonly income = computed<string>(() => this.formatCurrency(this.total()?.income ?? 0));
}
