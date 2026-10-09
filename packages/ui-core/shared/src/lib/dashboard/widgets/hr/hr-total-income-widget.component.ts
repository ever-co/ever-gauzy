import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { EmployeeStatisticsHistoryEnum } from '@gauzy/contracts';
import { BaseHrInfoWidgetComponent } from './base-hr-info-widget.component';
import { HrInfoCardComponent, IHrInfoBlockRow } from './hr-info-card.component';
import { HR_BLOCK_COLORS } from './hr-statistics.utils';

/**
 * Human Resources block: everything the selected employee brought in.
 *
 * Mirrors the legacy page's headline block, including its accordion: once part
 * of the income came from a direct bonus, the total alone is misleading, so the
 * block splits into plain income + direct income and explains the arithmetic in
 * its meta line. With no direct bonus there is nothing to split and the block
 * collapses to a single figure — exactly as on `/pages/dashboard/hr`.
 */
@Component({
	selector: 'ga-hr-total-income-widget',
	templateUrl: './hr-total-income-widget.component.html',
	standalone: true,
	imports: [HrInfoCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HrTotalIncomeWidgetComponent extends BaseHrInfoWidgetComponent {
	/** Colour of every income figure. */
	protected readonly color = HR_BLOCK_COLORS.INCOME;

	/** History opened when the headline block is clicked. */
	protected readonly historyType = EmployeeStatisticsHistoryEnum.INCOME;

	/** Formatted total income. */
	protected readonly value: Signal<string> = computed(() => this.formatAmount(this.totals().income));

	/** Whether any of the income came from a direct bonus. */
	private readonly hasDirectIncomeBonus: Signal<boolean> = computed(() => this.totals().directIncomeBonus !== 0);

	/** Breakdown line, shown only when there is something to break down. */
	protected readonly metaKey: Signal<string | null> = computed(() =>
		this.hasDirectIncomeBonus() ? 'DASHBOARD_PAGE.TITLE.TOTAL_INCOME_CALC' : null
	);

	/** Already formatted amounts interpolated into {@link metaKey}. */
	protected readonly metaParams: Signal<Record<string, unknown> | null> = computed(() => {
		if (!this.hasDirectIncomeBonus()) {
			return null;
		}
		const totals = this.totals();
		return {
			totalNonBonusIncome: this.formatAmount(totals.nonBonusIncome),
			totalBonusIncome: this.formatAmount(totals.directIncomeBonus)
		};
	});

	/** Accordion rows; empty keeps the block in its plain, non-accordion form. */
	protected readonly rows: Signal<IHrInfoBlockRow[]> = computed(() => {
		if (!this.hasDirectIncomeBonus()) {
			return [];
		}
		const totals = this.totals();
		return [
			{
				id: 'income',
				titleKey: 'INCOME_PAGE.INCOME',
				value: this.formatAmount(totals.nonBonusIncome),
				color: this.color,
				historyType: EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME
			},
			{
				id: 'direct-income',
				titleKey: 'DASHBOARD_PAGE.TITLE.TOTAL_DIRECT_INCOME',
				metaKey: 'DASHBOARD_PAGE.TITLE.TOTAL_DIRECT_INCOME_INFO',
				value: this.formatAmount(totals.directIncomeBonus),
				color: this.color,
				historyType: EmployeeStatisticsHistoryEnum.BONUS_INCOME
			}
		];
	});
}
