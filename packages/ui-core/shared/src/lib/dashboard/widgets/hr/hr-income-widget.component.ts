import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: income that did NOT come from a direct bonus.
 *
 * On the legacy page this figure only exists nested inside the Total Income
 * accordion. As a standalone widget it lets a canvas show the "real" earned
 * income without the bonus noise, which is the number most compensation
 * conversations actually start from.
 */
@Component({
	selector: 'ga-hr-income-widget',
	templateUrl: './hr-income-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrIncomeWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every income figure. */
	protected readonly color = HR_BLOCK_COLORS.INCOME;

	/** History opened when the block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME;

	/** Formatted income excluding the direct income bonus. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().nonBonusIncome));
}
