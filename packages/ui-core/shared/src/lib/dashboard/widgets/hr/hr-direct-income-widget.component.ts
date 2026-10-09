import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: the part of the income that came from a direct bonus.
 *
 * The counterpart of {@link HrIncomeWidgetComponent}: together the two add up to
 * the Total Income block. Nested inside the accordion on the legacy page, it is
 * exposed here as its own widget so a canvas can track bonus-driven income on
 * its own.
 */
@Component({
	selector: 'ga-hr-direct-income-widget',
	templateUrl: './hr-direct-income-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrDirectIncomeWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every income figure. */
	protected readonly color = HR_BLOCK_COLORS.INCOME;

	/** History opened when the block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.BONUS_INCOME;

	/** Formatted direct income bonus. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().directIncomeBonus));
}
