import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AccountingStatisticCardComponent } from './accounting-statistic-card.component';
import { BaseAccountingWidgetComponent } from './base-accounting-widget.component';

/**
 * KPI widget: total expenses booked across the organization in the selected period.
 *
 * Mirrors the second `<ga-single-statistic>` of the Accounting dashboard page,
 * down to its danger colour.
 */
@Component({
	selector: 'ga-total-expenses-widget',
	templateUrl: './total-expenses-widget.component.html',
	standalone: true,
	imports: [AccountingStatisticCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TotalExpensesWidgetComponent extends BaseAccountingWidgetComponent {
	/** Total expenses, formatted in the organization's currency. */
	protected readonly expenses = computed<string>(() => this.formatCurrency(this.total()?.expense ?? 0));
}
