import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	Input,
	OnChanges,
	OnInit,
	type SimpleChanges
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { IOrganizationRecurringExpense } from '@gauzy/contracts';
import { OrganizationRecurringExpenseService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';
import {
	ORGANIZATION_RECURRING_EXPENSES_LIST_LINK,
	RECURRING_COST_CHART_MONTHS,
	RECURRING_COST_CHART_MONTH_OPTIONS,
	RecurringExpenseState,
	buildOrganizationRecurringExpenseViewSections,
	loadOrganizationRecurringExpensePeriods,
	recurringExpenseCategoryName,
	recurringExpenseFocusMonth,
	recurringExpenseMonthBars,
	recurringExpenseMonthShare,
	recurringExpenseMonthsCharged,
	recurringExpenseStateOf
} from '../recurring-expense-record-view';
import { formatExpenseMoney } from '../../expenses/expense-record-view';
import { IExpenseChartBar, IExpenseMonthShare } from '../../expenses/expense-view/expense-view-charts';

/** The tone each state is drawn in, as the project and expense pages colour their status. */
const STATE_TONE: Record<RecurringExpenseState, string> = {
	active: 'success',
	upcoming: 'info',
	ended: 'basic'
};

/** The recurring expense's headline, worked out once per expense. */
export interface IRecurringExpenseHeadline {
	/** The category, translated when it is a default one. */
	title: string;
	state: RecurringExpenseState;
	/** i18n key of the state: Active, Upcoming or Ended. */
	stateKey: string;
	tone: string;
	/** Months charged so far, and what they add up to. */
	monthsCharged: number;
	totalCharged: number;
	/** How long ago it started, or how soon it starts, e.g. "a month ago". */
	since: string | null;
}

/** One period of the expense, as the history lists it. */
export interface IRecurringExpensePeriod {
	expense: IOrganizationRecurringExpense;
	isCurrent: boolean;
}

/** The share chart: this expense against the organization's other recurring expenses in one month. */
export interface IRecurringExpenseShare {
	loading: boolean;
	failed: boolean;
	share: IExpenseMonthShare | null;
	/** The month compared, e.g. "November 2026". */
	month: string | null;
}

const NO_SHARE: IRecurringExpenseShare = { loading: false, failed: false, share: null, month: null };

/**
 * One organization recurring expense, read-only: the headline — the category, where it stands and how often it
 * repeats, then the monthly amount, the start, the end and what it has cost so far as figures; its cost month by
 * month and the history of its amount; the details, its share of the month's recurring costs, then the stamps.
 *
 * Shown in two places, as the project quick look is: the recurring expenses list's right-side drawer, where it is
 * one column, and the expense's own page (`page`), where the headline runs across the top over two columns.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-quick-look',
	templateUrl: './recurring-expense-quick-look.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./recurring-expense-quick-look.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	host: { '[class.is-page]': 'page' }
})
export class RecurringExpenseQuickLookComponent extends TranslationBaseComponent implements OnInit, OnChanges {
	/** The recurring expense to show, as the host read it. */
	@Input() expense: IOrganizationRecurringExpense = null;
	/** The organization its history and its month are read in. */
	@Input() scope: IRecordViewScope = null;
	/** On the expense's own page: the headline across the top, then two columns. One column otherwise. */
	@Input() page = false;

	headline: IRecurringExpenseHeadline = null;
	/** The amount's periods, oldest first, this one among them. */
	periods: IRecurringExpensePeriod[] = [];
	periodsLoading = false;
	periodsFailed = false;

	/** The monthly cost chart: one bar per month, drawn from the periods. */
	costBars: IExpenseChartBar[] = [];
	/** The chart's span in months: its range filter. */
	costMonths = RECURRING_COST_CHART_MONTHS;
	readonly costMonthOptions = RECURRING_COST_CHART_MONTH_OPTIONS;
	/** This expense against the organization's other recurring expenses, in the month it is about. */
	share: IRecurringExpenseShare = NO_SHARE;
	/** Formats a chart's amount in the expense's currency. */
	readonly formatAmount = (value: number): string =>
		formatExpenseMoney(value, this.expense?.currency, this.translateService.getCurrentLang() || undefined);

	/** Every field of the expense. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps. */
	metaSections: IRecordViewSection[] = [];

	/** Bumped by every read of the history; a read that is no longer the latest one when it answers is discarded. */
	private periodsSequence = 0;
	/** The same for the share chart's read. */
	private shareSequence = 0;

	constructor(
		public readonly translateService: TranslateService,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// The category, the state, the months and "a month ago" are worked out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		const scopeChanged =
			!!changes['scope'] &&
			changes['scope'].previousValue?.organizationId !== changes['scope'].currentValue?.organizationId;
		if (changes['expense'] || scopeChanged) {
			this.show();
		}
	}

	/** Sets the monthly cost chart's span; the periods already read are drawn again, nothing is read. */
	setCostMonths(months: number): void {
		this.costMonths = months;
		this.describeCostBars();
	}

	/** The link of a period of the history: its own page. */
	periodLink(period: IRecurringExpensePeriod): string[] {
		return [ORGANIZATION_RECURRING_EXPENSES_LIST_LINK, 'view', period.expense.id];
	}

	/* ── Reading and describing ── */

	/** Draws the expense and reads what it is compared with; nothing of a previous expense stays. */
	private show(): void {
		this.periodsSequence++;
		this.shareSequence++;
		this.periods = [];
		this.costBars = [];
		this.share = NO_SHARE;
		this.periodsLoading = false;
		this.periodsFailed = false;
		this.describe();
		const expense = this.expense;
		if (expense) {
			void this.loadPeriods(expense);
			void this.loadShare(expense);
		}
	}

	/** Reads the other periods of the same recurring expense. A failed read leaves the rest as it is. */
	private async loadPeriods(expense: IOrganizationRecurringExpense): Promise<void> {
		const scope = this.scope;
		const sequence = ++this.periodsSequence;
		this.periods = [{ expense, isCurrent: true }];
		this.describeCostBars();
		if (!scope) return;
		this.periodsLoading = true;
		try {
			const periods = await loadOrganizationRecurringExpensePeriods(this.organizationRecurringExpenseService, expense, scope);
			if (sequence !== this.periodsSequence) return;
			const list = periods.some((period) => period.id === expense.id) ? periods : [...periods, expense];
			this.periods = list.map((period) => ({ expense: period, isCurrent: period.id === expense.id }));
			this.describeCostBars();
		} catch {
			if (sequence === this.periodsSequence) {
				this.periodsFailed = true;
			}
		} finally {
			if (sequence === this.periodsSequence) {
				this.periodsLoading = false;
				this.cdr.markForCheck();
			}
		}
	}

	/**
	 * Reads the organization's recurring expenses in the month the expense is about (today's, kept within its
	 * months) with the read the recurring expenses list makes. A failed read leaves the rest as it is; the chart's
	 * panel says so.
	 */
	private async loadShare(expense: IOrganizationRecurringExpense): Promise<void> {
		const scope = this.scope;
		if (!scope) return;
		const sequence = ++this.shareSequence;
		const month = recurringExpenseFocusMonth(expense);
		this.share = { ...NO_SHARE, loading: true };
		try {
			const { items = [] } = await this.organizationRecurringExpenseService.getAllByMonth({
				organizationId: scope.organizationId,
				tenantId: scope.tenantId,
				startDate: month.clone().startOf('month').toDate(),
				endDate: month.clone().endOf('month').toDate()
			});
			if (sequence !== this.shareSequence) return;
			this.share = {
				loading: false,
				failed: false,
				share: recurringExpenseMonthShare(expense, items),
				month: this.focusMonthName(expense)
			};
		} catch {
			if (sequence === this.shareSequence) {
				this.share = { ...NO_SHARE, failed: true };
			}
		} finally {
			if (sequence === this.shareSequence) {
				this.cdr.markForCheck();
			}
		}
	}

	/** Draws the monthly cost chart from the periods read, in the viewer's language. */
	private describeCostBars(): void {
		const expense = this.expense;
		if (!expense) {
			this.costBars = [];
			return;
		}
		const periods = this.periods.length ? this.periods.map((period) => period.expense) : [expense];
		const locale = this.translateService.getCurrentLang() || 'en';
		this.costBars = recurringExpenseMonthBars(periods, expense, this.costMonths, locale);
	}

	/** The month the share chart compares, in the viewer's language, e.g. "November 2026". */
	private focusMonthName(expense: IOrganizationRecurringExpense): string {
		const locale = this.translateService.getCurrentLang() || 'en';
		return recurringExpenseFocusMonth(expense).locale(locale).format('MMMM YYYY');
	}

	/** Works out the headline and the sections from the expense, in the viewer's language. */
	private describe(): void {
		const expense = this.expense;
		if (!expense) {
			this.headline = null;
			this.detailsSections = [];
			this.metaSections = [];
			return;
		}
		const translate = (key: string) => this.getTranslation(key);
		const locale = this.translateService.getCurrentLang() || 'en';
		const state = recurringExpenseStateOf(expense);
		const monthsCharged = recurringExpenseMonthsCharged(expense);
		this.headline = {
			title: recurringExpenseCategoryName(expense.categoryName, translate) || translate('ORGANIZATIONS_PAGE.RECURRING_EXPENSE'),
			state,
			stateKey: `RECURRING_EXPENSE_VIEW.${state.toUpperCase()}`,
			tone: STATE_TONE[state],
			monthsCharged,
			totalCharged: monthsCharged * (Number(expense.value) || 0),
			since: expense.startDate ? moment(expense.startDate).locale(locale).fromNow() : null
		};

		this.describeCostBars();
		if (this.share.month) {
			this.share = { ...this.share, month: this.focusMonthName(expense) };
		}

		// The drawer's fields, every one of them, under the panel's title.
		this.detailsSections = buildOrganizationRecurringExpenseViewSections(expense, translate).map((section) => ({
			...section,
			title: 'EXPENSE_VIEW.DETAILS',
			icon: 'info-outline'
		}));

		this.metaSections = [
			{
				variant: 'meta',
				fields: [
					{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
					{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
				]
			}
		];
	}
}
