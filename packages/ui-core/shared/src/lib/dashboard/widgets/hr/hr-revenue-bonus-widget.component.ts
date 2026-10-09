import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { BonusTypeEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: the bonus an organization on a REVENUE-based rule owes.
 *
 * A percentage of the employee's total income rather than of their profit, so
 * unlike {@link HrProfitBonusWidgetComponent} it does not follow the cost side
 * down.
 *
 * Only meaningful for organizations whose bonus type is
 * {@link BonusTypeEnum.REVENUE_BASED_BONUS}; for anyone else the widget explains
 * itself instead of showing a number that means nothing.
 */
@Component({
	selector: 'ga-hr-revenue-bonus-widget',
	templateUrl: './hr-revenue-bonus-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrRevenueBonusWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Formatted rule-derived bonus. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().calculatedBonus));

	/** Success while the bonus is positive, danger once it has to be clawed back. */
	protected readonly color: Signal<string> = computed(() =>
		this.signedColor(this.totals().calculatedBonus, HR_BLOCK_COLORS.BONUS, HR_BLOCK_COLORS.NEGATIVE)
	);

	/** Percentage and income interpolated into the "x% of the income y" line. */
	protected readonly metaParams: Signal<Record<string, unknown>> = computed(() => ({
		bonusPercentage: this.bonusPercentage(),
		totalIncome: this.formatAmount(this.totals().income)
	}));

	/** Set when the organization uses a different bonus rule (or none). */
	protected readonly unavailableKey: Signal<string | null> = computed(() => {
		const bonusType = this.bonusType();
		if (bonusType === BonusTypeEnum.REVENUE_BASED_BONUS) {
			return null;
		}
		return bonusType
			? 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.NOT_REVENUE_BASED'
			: 'DASHBOARD_PAGE.BUILDER.WIDGETS.HR.NO_BONUS_TYPE';
	});
}
