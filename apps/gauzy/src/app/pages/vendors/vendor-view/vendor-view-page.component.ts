import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import * as moment from 'moment';
import { BaseEntityEnum, IExpense, IOrganization } from '@gauzy/contracts';
import { OrganizationVendorsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import { formatExpenseMoney } from '../../expenses/expense-record-view';
import { IExpenseChartBar } from '../../expenses/expense-view/expense-view-charts';
import { ExpenseChartKind } from '../../expenses/expense-view/expense-charts/expense-bar-chart.component';
import {
	buildVendorViewSections,
	IVendorExpenseSummary,
	IVendorRecord,
	loadVendor,
	loadVendorExpenses,
	summarizeVendorExpenses,
	VENDORS_LIST_LINK
} from '../vendor-record-view';
import {
	chartCurrencyOf,
	currenciesOf,
	spendBars,
	VENDOR_CHART_MONTHS,
	VENDOR_CHART_MONTH_OPTIONS
} from './vendor-view-charts';

export const VENDOR_CHART_KIND_OPTIONS: ReadonlyArray<{ kind: ExpenseChartKind; icon: string; label: string }> = [
	{ kind: 'bar', icon: 'bar-chart-outline', label: 'INCOME_VIEW.BAR_CHART' },
	{ kind: 'line', icon: 'activity-outline', label: 'INCOME_VIEW.LINE_CHART' }
];

export const VENDOR_RECENT_EXPENSES = 10;

export const EXPENSES_LIST_LINK = '/pages/accounting/expenses';

export interface IVendorExpenseRow {
	id: string;
	name: string | null;
	date: Date | string | null;
	amount: string;
}

export interface IVendorSpendChart {
	bars: IExpenseChartBar[];
	currency: string | null;
	otherCurrencies: string[];
}

const NO_CHART: IVendorSpendChart = { bars: [], currency: null, otherCurrencies: [] };

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vendor-view-page',
	templateUrl: './vendor-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./vendor-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	host: { class: 'is-page' }
})
export class VendorViewPageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly injector = inject(Injector);
	private readonly vendorsService = inject(OrganizationVendorsService);
	private readonly toastrService = inject(ToastrService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);

	constructor() {
		super();
	}

	readonly favoriteEntity = BaseEntityEnum.OrganizationVendor;
	readonly backLink = VENDORS_LIST_LINK;
	readonly expensesLink = EXPENSES_LIST_LINK;

	vendor: IVendorRecord = null;
	expenses: IExpense[] | null = null;
	summary: IVendorExpenseSummary | null = null;
	daysSinceLast: number | null = null;
	currencies: string[] = [];
	recentExpenses: IVendorExpenseRow[] = [];

	chart: IVendorSpendChart = NO_CHART;
	chartMonths = VENDOR_CHART_MONTHS;
	readonly chartMonthOptions = VENDOR_CHART_MONTH_OPTIONS;
	chartKind: ExpenseChartKind = 'bar';
	readonly chartKindOptions = VENDOR_CHART_KIND_OPTIONS;
	readonly formatSpend = (value: number): string =>
		formatExpenseMoney(value, this.chart.currency, this.translateService.getCurrentLang() || undefined);

	sideSections: IRecordViewSection[] = [];
	minimumOrder: string | null = null;

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;

	private vendorId: string = null;
	private loadSequence = 0;

	ngOnInit(): void {
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				this.vendorId = id;
				this.organization = organization;
				void this.load();
			});
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	ngOnDestroy(): void {
		this.loadSequence++;
	}

	async load(): Promise<void> {
		const id = this.vendorId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		this.vendor = null;
		this.expenses = null;
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const [vendor, expenses] = await Promise.all([
				loadVendor(this.vendorsService, id, scope),
				loadVendorExpenses(this.injector, id, scope, ['category'])
			]);
			if (sequence !== this.loadSequence) {
				return;
			}
			if (!vendor || (vendor.organizationId && vendor.organizationId !== scope.organizationId)) {
				throw { status: 404 };
			}
			this.vendor = vendor;
			this.expenses = expenses;
			this.describe();
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.state = recordViewPageStateOf(error);
		} finally {
			this.cdr.markForCheck();
		}
	}

	async copyLink(): Promise<void> {
		if (!this.vendor) return;
		const path = this.router.serializeUrl(this.router.createUrlTree([VENDORS_LIST_LINK, 'view', this.vendor.id]));
		const { origin, pathname, hash } = window.location;
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('EXPENSE_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	setChartMonths(months: number): void {
		this.chartMonths = months;
		this.describeChart();
	}

	setChartKind(kind: ExpenseChartKind): void {
		this.chartKind = kind;
	}

	private describe(): void {
		const vendor = this.vendor;
		if (!vendor) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || undefined;
		const expenses = this.expenses;

		this.summary = expenses ? summarizeVendorExpenses(expenses) : null;
		this.currencies = expenses ? currenciesOf(expenses) : [];
		this.daysSinceLast = this.summary?.lastExpenseDate
			? Math.max(moment().startOf('day').diff(moment(this.summary.lastExpenseDate).startOf('day'), 'days'), 0)
			: null;
		this.recentExpenses = expenses ? this.recentRows(expenses, locale) : [];

		const minimumOrder = Number(vendor.minimumOrderAmount);
		this.minimumOrder =
			vendor.minimumOrderAmount !== null && vendor.minimumOrderAmount !== undefined && Number.isFinite(minimumOrder)
				? formatExpenseMoney(minimumOrder, vendor.currency, locale)
				: null;

		this.sideSections = buildVendorViewSections({ ...vendor, expenseSummary: null }, (key) =>
			this.getTranslation(key)
		);
		this.describeChart();
	}

	private recentRows(expenses: IExpense[], locale?: string): IVendorExpenseRow[] {
		return expenses
			.map((expense) => ({ expense, time: expense.valueDate ? new Date(expense.valueDate).getTime() : 0 }))
			.sort((a, b) => b.time - a.time)
			.slice(0, VENDOR_RECENT_EXPENSES)
			.map(({ expense }) => ({
				id: expense.id,
				name: expense.category?.name || expense.notes || expense.purpose || null,
				date: expense.valueDate ?? null,
				amount: formatExpenseMoney(Number(expense.amount) || 0, expense.currency, locale)
			}));
	}

	private describeChart(): void {
		const expenses = this.expenses;
		if (!this.vendor || !expenses?.length) {
			this.chart = NO_CHART;
			return;
		}
		const currency = chartCurrencyOf(expenses);
		this.chart = {
			bars: spendBars(expenses, currency, this.chartMonths, this.translateService.getCurrentLang() || 'en'),
			currency,
			otherCurrencies: currenciesOf(expenses).filter((other) => other !== currency)
		};
	}

	private scope(): IRecordViewScope | null {
		return this.organization ? { organizationId: this.organization.id, tenantId: this.organization.tenantId } : null;
	}
}
