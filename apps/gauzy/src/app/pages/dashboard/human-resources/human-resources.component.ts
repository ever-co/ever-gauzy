import { Component, OnDestroy, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '@gauzy/ui-config';
import {
	BonusTypeEnum,
	CurrencyPosition,
	EmployeeStatisticsHistoryEnum,
	IDateRangePicker,
	IMonthAggregatedEmployeeStatistics,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, toUTC } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, EmployeeStatisticsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { CurrencyPositionPipe, ProfitHistoryComponent, RecordsHistoryComponent } from '@gauzy/ui-core/shared';
import { EmployeeChartEnum } from '../employee-charts';

/**
 * Every money figure the page prints, already formatted for display.
 *
 * Formatting lives here rather than in the template because each figure needs
 * the same three steps — coalesce a missing value to zero, apply the currency,
 * then move the symbol to the side the organization configured. Spelling that
 * out as a ternary plus two pipes per figure is what made the previous template
 * unreadable, and the KPI row multiplies the number of call sites.
 */
interface IHumanResourcesFigures {
	income: string;
	nonBonusIncome: string;
	directIncomeBonus: string;
	expense: string;
	expenseWithoutSalary: string;
	salary: string;
	profit: string;
	bonus: string;
	calculatedBonus: string;
	averageBonus: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-human-resources',
	templateUrl: './human-resources.component.html',
	styleUrls: ['./human-resources.component.scss'],
	standalone: false,
	providers: [CurrencyPipe, CurrencyPositionPipe]
})
export class HumanResourcesComponent implements OnInit, OnDestroy {
	/**
	 * Starts true: the employee / organization / date-range streams are debounced
	 * by 300ms, so the first paint happens before anything is resolved. Starting
	 * false would render the "no employee selected" empty state for that window
	 * on every single visit. Cleared once those streams settle — in `ngOnInit`
	 * when they settle without an employee, and in `getEmployeeStatistics()`
	 * when they settle with one.
	 */
	loading = true;

	selectedEmployee: ISelectedEmployee;
	selectedOrganization: IOrganization;
	selectedDateRange: IDateRangePicker;

	defaultCurrency: string;

	incomePermissionsError = false;
	expensePermissionError = false;

	employeeStatistics: IMonthAggregatedEmployeeStatistics[];
	expense = 0;
	expenseWithoutSalary: number;
	income: number;
	nonBonusIncome: number;
	profit: number;
	directIncomeBonus: number;
	bonus: number;
	calculatedBonus: number;
	bonusType: BonusTypeEnum;
	bonusPercentage: number;
	salary: number;
	averageBonus: number;

	/** Display strings for {@link IHumanResourcesFigures}, rebuilt on every load. */
	figures: IHumanResourcesFigures = HumanResourcesComponent.emptyFigures();

	/**
	 * The formula shown on the Total Bonus tile's tooltip: which of the three
	 * applies depends on the organization's bonus type and on whether any direct
	 * income bonus was earned.
	 *
	 * Resolved here rather than as a chain of `@if`s in the template because a
	 * tooltip is an attribute binding and cannot host control flow. Snapshotted
	 * alongside {@link figures} so the params object is not rebuilt on every
	 * change-detection pass.
	 */
	bonusFormula: { key: string; params: Record<string, string | number> } | null = null;

	/**
	 * Which chart the statistics panel draws. Owned here rather than inside
	 * `ga-employee-charts` so the switcher can sit in that panel's header, on the
	 * same line as its title.
	 */
	selectedChart: EmployeeChartEnum = EmployeeChartEnum.BAR;

	/** Exposed for the switcher's `[value]` bindings. */
	readonly EmployeeChartEnum = EmployeeChartEnum;

	statistics$: Subject<any> = new Subject();

	constructor(
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly toastrService: ToastrService,
		private readonly currencyPipe: CurrencyPipe,
		private readonly currencyPositionPipe: CurrencyPositionPipe
	) {}

	async ngOnInit() {
		this.statistics$
			.pipe(
				debounceTime(300),
				tap(() => this.getEmployeeStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const selectedEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, selectedDateRange$, selectedEmployee$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				/*
				 * Before the filter, so it runs on the emission where there is no
				 * employee too. `loading` is otherwise only cleared inside
				 * `getEmployeeStatistics()`, which the filter below can never reach
				 * without one — so with no employee ever selected the spinner ran
				 * forever and the "no employee selected" state, gated on `!loading`,
				 * was unreachable. Past the debounce the selectors have settled: if
				 * there is still no employee the page is not waiting on anything.
				 */
				tap(([, , employee]) => {
					if (!employee) {
						this.loading = false;
					}
				}),
				filter(([organization, dateRange, employee]) => !!organization && !!dateRange && !!employee),
				tap(([organization, dateRange, employee]) => {
					this.selectedOrganization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployee = employee;
				}),
				tap(() => {
					if (!this.selectedEmployee || !this.selectedEmployee.id) {
						this.navigateToAccounting();
						return;
					}
				}),
				tap(([organization]) => {
					this.bonusType = organization.bonusType as BonusTypeEnum;
					this.bonusPercentage = organization.bonusPercentage;
					this.defaultCurrency = organization.currency;
				}),
				tap(() => this.statistics$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getEmployeeStatistics() {
		if (!this.selectedOrganization) {
			// Nothing to ask for. Release the initial spinner rather than leaving it
			// running forever over an empty page.
			this.loading = false;
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		this.loading = true;

		try {
			this.employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId({
				employeeId: this.selectedEmployee.id,
				startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
				endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
				organizationId,
				tenantId
			});
			this.income = this._statsSum(this.employeeStatistics, 'income');
			this.expenseWithoutSalary = this._statsSum(this.employeeStatistics, 'expenseWithoutSalary');
			this.expense = this._statsSum(this.employeeStatistics, 'expense');
			this.directIncomeBonus = this._statsSum(this.employeeStatistics, 'directIncomeBonus');
			this.nonBonusIncome = this.income - this.directIncomeBonus;
			this.profit = this._statsSum(this.employeeStatistics, 'profit');
			this.bonus = this._statsSum(this.employeeStatistics, 'bonus');
			this.calculatedBonus = +(this.bonus - this.directIncomeBonus).toFixed(2);
			this.salary = +(this.expense - this.expenseWithoutSalary).toFixed(2);
			// The header has always had an "Average Monthly Bonus" row, but the field
			// behind it was declared and never assigned, so the row could not render.
			// The aggregation is per month, so the mean is the total over the number
			// of months the API actually returned.
			const months = this.employeeStatistics?.length ?? 0;
			this.averageBonus = months ? +(this.bonus / months).toFixed(2) : 0;
		} catch (error) {
			console.error('Error while retrieving employee aggregated statistics', error);
			this.toastrService.danger(error);
		} finally {
			this.figures = this.buildFigures();
			this.bonusFormula = this.buildBonusFormula();
			this.loading = false;
		}
	}

	/** Whether the organization pays bonuses at all — gates the bonus KPI and section. */
	get hasBonus(): boolean {
		return !!this.selectedOrganization?.bonusType;
	}

	/** Initials shown while the avatar image is missing or fails to load. */
	get employeeInitials(): string {
		const { firstName, lastName, fullName } = this.selectedEmployee ?? ({} as ISelectedEmployee);
		const parts = [firstName, lastName].filter(Boolean) as string[];
		const source = parts.length ? parts : (fullName ?? '').split(' ').filter(Boolean);
		return source
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join('');
	}

	/**
	 * Formats one figure the way the organization is configured to show money.
	 *
	 * Deliberately the same shape as `EmployeeDoughnutChartComponent.formatCurrency`
	 * — the charts rendered beside these figures format their own labels that way,
	 * and the two must not disagree. Both fall back to the configured default
	 * currency rather than printing a bare number: the `position` pipe extracts a
	 * symbol out of its input and cannot be handed an unformatted value.
	 */
	private toCurrency(value: number): string {
		const currencyPosition = this.selectedOrganization?.currencyPosition || CurrencyPosition.LEFT;
		const formatted = this.currencyPipe.transform(value || 0, this.defaultCurrency || environment.DEFAULT_CURRENCY);
		return this.currencyPositionPipe.transform(formatted, currencyPosition);
	}

	/** Snapshots every total as a display string, so the template holds no formatting. */
	private buildFigures(): IHumanResourcesFigures {
		return {
			income: this.toCurrency(this.income),
			nonBonusIncome: this.toCurrency(this.nonBonusIncome),
			directIncomeBonus: this.toCurrency(this.directIncomeBonus),
			expense: this.toCurrency(this.expense),
			expenseWithoutSalary: this.toCurrency(this.expenseWithoutSalary),
			salary: this.toCurrency(this.salary),
			profit: this.toCurrency(this.profit),
			bonus: this.toCurrency(this.bonus),
			calculatedBonus: this.toCurrency(this.calculatedBonus),
			averageBonus: this.toCurrency(this.averageBonus)
		};
	}

	/**
	 * Picks the bonus formula that matches how this organization pays bonuses.
	 *
	 * Mirrors the branch order the template used to carry inline: a direct income
	 * bonus describes the total as its two parts, and otherwise the organization's
	 * bonus type decides whether the bonus is a share of revenue or of profit.
	 */
	private buildBonusFormula(): { key: string; params: Record<string, string | number> } | null {
		if (this.directIncomeBonus) {
			return {
				key: 'DASHBOARD_PAGE.TITLE.TOTAL_BONUS_CALC',
				params: {
					totalBonusIncome: this.figures.directIncomeBonus,
					calculatedBonus: this.figures.calculatedBonus
				}
			};
		}
		if (this.bonusType === BonusTypeEnum.REVENUE_BASED_BONUS) {
			return {
				key: 'DASHBOARD_PAGE.TITLE.TOTAL_INCOME_BONUS_INFO',
				params: { bonusPercentage: this.bonusPercentage || 0, totalIncome: this.figures.income }
			};
		}
		if (this.bonusType === BonusTypeEnum.PROFIT_BASED_BONUS) {
			return {
				key: 'DASHBOARD_PAGE.TITLE.TOTAL_PROFIT_BONUS_INFO',
				params: { bonusPercentage: this.bonusPercentage || 0, difference: this.figures.profit }
			};
		}
		return null;
	}

	/** Placeholder figures used before the first response lands. */
	private static emptyFigures(): IHumanResourcesFigures {
		return {
			income: '',
			nonBonusIncome: '',
			directIncomeBonus: '',
			expense: '',
			expenseWithoutSalary: '',
			salary: '',
			profit: '',
			bonus: '',
			calculatedBonus: '',
			averageBonus: ''
		};
	}

	async openHistoryDialog(type: EmployeeStatisticsHistoryEnum) {
		if (!this.selectedOrganization) {
			return;
		}
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				records: await this.employeeStatisticsService.getEmployeeStatisticsHistory({
					employeeId: this.selectedEmployee.id,
					startDate,
					endDate,
					type,
					organizationId,
					tenantId
				})
			}
		});
	}

	/**
	 *
	 * @returns
	 */
	async openProfitDialog() {
		if (!this.selectedOrganization) {
			return;
		}

		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		const incomes = await this.employeeStatisticsService.getEmployeeStatisticsHistory({
			employeeId: this.selectedEmployee.id,
			startDate,
			endDate,
			type: EmployeeStatisticsHistoryEnum.INCOME,
			organizationId,
			tenantId
		});
		const expenses = await this.employeeStatisticsService.getEmployeeStatisticsHistory({
			employeeId: this.selectedEmployee.id,
			startDate,
			endDate,
			type: EmployeeStatisticsHistoryEnum.EXPENSES,
			organizationId,
			tenantId
		});

		this.dialogService.open(ProfitHistoryComponent, {
			context: {
				records: {
					incomes,
					expenses,
					incomeTotal: this.income,
					expenseTotal: this.expense,
					profit: this.profit
				}
			}
		});
	}

	/**
	 *
	 * @param employeeStatistics
	 * @param key
	 * @returns
	 */
	private _statsSum = (employeeStatistics: IMonthAggregatedEmployeeStatistics[], key: string): number => {
		return Number(employeeStatistics.reduce((a, b) => a + b[key], 0).toFixed(2));
	};

	/**
	 *
	 */
	navigateToAccounting() {
		this.router.navigate(['/pages/dashboard/accounting']);
	}

	/**
	 *
	 */
	edit() {
		this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id]);
	}

	/**
	 * Position and seniority, as separate labels.
	 *
	 * Returned as an array rather than the pipe-joined string the header used to
	 * print, so each one can be rendered as its own chip — and so an employee
	 * with only one of the two does not render a dangling separator.
	 */
	get employeeTraits(): string[] {
		const { shortDescription, employeeLevel } = this.selectedEmployee ?? ({} as ISelectedEmployee);
		return [shortDescription, employeeLevel].filter(Boolean) as string[];
	}

	ngOnDestroy() {}
}
