import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: bonus that is simply the employee's direct income.
 *
 * The legacy page hides this block entirely when the organization pays no
 * bonuses. A widget cannot silently disappear from a canvas the user built, so
 * it says so instead — an explanation the user can act on beats an empty card.
 */
@Component({
	selector: 'ga-hr-total-direct-bonus-widget',
	templateUrl: './hr-total-direct-bonus-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrTotalDirectBonusWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every bonus figure. */
	protected readonly color = HR_BLOCK_COLORS.BONUS;

	/** History opened when the block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.BONUS_INCOME;

	/** Formatted direct income bonus. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().directIncomeBonus));

	/** Set when the organization pays no bonuses at all. */
	protected readonly unavailableKey: Signal<string | null> = computed(() =>
		this.bonusType() ? null : 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.NO_BONUS_TYPE'
	);
}
