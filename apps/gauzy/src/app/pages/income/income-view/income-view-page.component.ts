import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment';
import {
	BaseEntityEnum,
	IEmployee,
	IIncome,
	IOrganization,
	IOrganizationContact,
	ITag,
	PermissionsEnum
} from '@gauzy/contracts';
import { ErrorHandlingService, IncomeService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	ALL_EMPLOYEES_SELECTED,
	DeleteConfirmationComponent,
	IncomeMutationComponent,
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import { formatExpenseMoney } from '../../expenses/expense-record-view';
import {
	categoryMonthBars,
	categoryReadRange,
	CATEGORY_CHART_MONTHS,
	CATEGORY_CHART_MONTH_OPTIONS,
	CATEGORY_CHART_READ_MONTHS,
	IExpenseChartBar,
	IExpenseMonthShare,
	monthShareOf,
	vendorPaymentBars,
	vendorReadRange,
	VENDOR_CHART_PAYMENTS,
	VENDOR_CHART_PAYMENT_OPTIONS,
	VENDOR_CHART_READ_PAYMENTS
} from '../../expenses/expense-view/expense-view-charts';
import { ExpenseChartKind } from '../../expenses/expense-view/expense-charts/expense-bar-chart.component';
import { loadIncome } from '../income-record-view';

/** The page size of the charts' paged reads: the most the income API serves at once. */
const CHART_READ_PAGE = 100;

/** Where the income page's back button leads, and where a deleted income's page goes. */
export const INCOME_LIST_LINK = '/pages/accounting/income';

/** The chart panels whose drawing can be switched: the client's months, and the client's payments. */
export type IncomeChartPanel = 'client' | 'payments';

/** The switch in a chart panel's header: one icon button per way of drawing the amounts. */
export const INCOME_CHART_KIND_OPTIONS: ReadonlyArray<{ kind: ExpenseChartKind; icon: string; label: string }> = [
	{ kind: 'bar', icon: 'bar-chart-outline', label: 'INCOME_VIEW.BAR_CHART' },
	{ kind: 'line', icon: 'activity-outline', label: 'INCOME_VIEW.LINE_CHART' }
];

/** What the income form closes with on save: its raw value, one field per control (`IncomeMutationComponent`). */
export interface IIncomeFormAnswer {
	amount: number;
	organizationContact: IOrganizationContact | null;
	valueDate: Date;
	notes?: string;
	currency?: string;
	isBonus: boolean;
	tags: ITag[];
	/** The form's employee control: an employee, or the "All employees" entry. */
	employee?: Partial<IEmployee> | null;
}

/** The income's headline, worked out once per load. */
export interface IIncomeHeadline {
	/** Who paid — else "Income". */
	title: string;
	/** The employee the income is booked to, when it is one. */
	employee: string | null;
	/** How long ago the income was received, e.g. "3 days ago". */
	since: string | null;
}

/** The charts: the incomes they compare this one with, and what is drawn from them. */
export interface IIncomeCharts {
	loading: boolean;
	failed: boolean;
	/** The client's income per month, ending with this income's month. */
	clientBars: IExpenseChartBar[];
	/** The payments from the client, this one among them. */
	paymentBars: IExpenseChartBar[];
	/** What the client paid over the twelve months ending with this income's month. */
	clientTotal: number | null;
	/** This income against all the organization's income in its month. */
	share: IExpenseMonthShare | null;
	/** The month the share is of, e.g. "March 2026". */
	shareMonth: string | null;
}

const NO_CHARTS: IIncomeCharts = {
	loading: false,
	failed: false,
	clientBars: [],
	paymentBars: [],
	clientTotal: null,
	share: null,
	shareMonth: null
};

/**
 * An income on its own full-width page, `/pages/accounting/income/view/:id` (handover §4.P): what an income favorite
 * in the sidebar opens, and where the income drawer's "expand to full width" icon leads.
 *
 * Laid out as the expense page, with the facts Hubstaff puts on a payment: the actions — Edit, Duplicate, Copy link,
 * the star and Delete — beside the back button; the headline — who paid, whether it is a bonus and who it is booked
 * to, then the amount, the type, the date and what the client paid over the year as figures; the record in the wide
 * column — the notes and tags, then how it compares: the client's income by month and its payments; and the facts
 * in the side column — the details, the income's share of its month, then the stamps.
 *
 * The page belongs to the organization selected in the header, like the income list: an income of another
 * organization reads "not found", and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-income-view-page',
	templateUrl: './income-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./income-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	// The project page's page layout: headline, then two columns.
	host: { class: 'is-page' }
})
export class IncomeViewPageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	// The base class injects the TranslateService itself.
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly dialogService = inject(NbDialogService);
	private readonly incomeService = inject(IncomeService);
	private readonly toastrService = inject(ToastrService);
	private readonly errorHandler = inject(ErrorHandlingService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);

	// Explicit, so the compiler does not inherit the undecorated base class's constructor (NG2006); the base injects
	// the TranslateService itself when it is given none.
	constructor() {
		super();
	}

	readonly PermissionsEnum = PermissionsEnum;
	readonly favoriteEntity = BaseEntityEnum.Income;
	readonly backLink = INCOME_LIST_LINK;
	/** The months the "from this client" figure adds up. */
	readonly clientTotalMonths = CATEGORY_CHART_READ_MONTHS;

	/** The income as read: what the edit dialog is opened on, and what the record sections read. */
	income: IIncome = null;
	headline: IIncomeHeadline = null;

	/** The notes and the tags, in the wide column. */
	mainSections: IRecordViewSection[] = [];
	/** The details, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];

	/** The client and month charts, read after the income itself. */
	charts: IIncomeCharts = NO_CHARTS;
	/** The client chart's span in months, and the payments the payments chart shows at most: the panels' filters. */
	clientMonths = CATEGORY_CHART_MONTHS;
	clientPayments = VENDOR_CHART_PAYMENTS;
	readonly clientMonthOptions = CATEGORY_CHART_MONTH_OPTIONS;
	readonly clientPaymentOptions = VENDOR_CHART_PAYMENT_OPTIONS;
	/** How each chart panel draws its amounts: bars or a line, switched in the panel's header. */
	chartKinds: Record<IncomeChartPanel, ExpenseChartKind> = { client: 'bar', payments: 'bar' };
	readonly chartKindOptions = INCOME_CHART_KIND_OPTIONS;
	/** Formats an amount in the income's currency. */
	readonly formatAmount = (value: number): string =>
		formatExpenseMoney(value, this.income?.currency, this.translateService.getCurrentLang() || undefined);

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit, a duplicate or a delete is being saved: the actions wait for it. */
	busy = false;

	private incomeId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/** The same for the charts' reads, which answer after the income's. */
	private chartsSequence = 0;
	/** The incomes of this one's client, its client's payments and its month, as the charts last read them. */
	private clientIncomes: IIncome[] = [];
	private paymentIncomes: IIncome[] = [];
	private monthIncomes: IIncome[] = [];
	/** The edit, duplicate or delete dialog that is open: closed when the page turns to another income or organization. */
	private openDialog: NbDialogRef<unknown> | null = null;

	ngOnInit(): void {
		// The component is reused across `view/:id` navigations, and the page follows the header's
		// organization: either changing reloads.
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
				// A dialog opened on the previous income must not act on it once the page shows another.
				this.openDialog?.close();
				this.incomeId = id;
				this.organization = organization;
				void this.load();
			});
		// "3 days ago", the month names and the amounts are worked out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	ngOnDestroy(): void {
		// Reads still in flight are discarded when they answer, and stop requesting pages: no page owns them now.
		this.loadSequence++;
		this.chartsSequence++;
		// Leaving the page closes its dialog: an answer given after that would act on an income no longer shown.
		this.openDialog?.close();
	}

	/** Loads (or reloads, after an error) the income the URL names. */
	async load(): Promise<void> {
		const id = this.incomeId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// The previous income's chart reads are discarded too: answering now, they would refill what is cleared here.
		this.chartsSequence++;
		// Nothing of the previous income stays on screen while this one loads or if it fails.
		this.income = null;
		this.headline = null;
		this.charts = NO_CHARTS;
		this.clientIncomes = [];
		this.paymentIncomes = [];
		this.monthIncomes = [];
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const income = await loadIncome(this.incomeService, id, scope);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!income || (income.organizationId && income.organizationId !== scope.organizationId)) {
				throw { status: 404 };
			}
			this.show(income);
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

	/* ── Actions ── */

	/** Opens the income form the list edits with, then saves what it answers and reads the income again. */
	async edit(): Promise<void> {
		const income = this.income;
		if (!income || this.busy) return;
		const edited = await this.ask<IIncomeFormAnswer>(
			this.dialogService.open(IncomeMutationComponent, { context: { income } }),
			income
		);
		if (!edited) return;
		this.setBusy(true);
		// The page the edit is saved from: once it turns (another income or organization) or is left, no refresh.
		const sequence = this.loadSequence;
		try {
			// As the list saves it: the income's own employee, not the form's employee control.
			const { amount, organizationContact, valueDate, notes, currency, isBonus, tags } = edited;
			await this.incomeService.update(income.id, {
				amount,
				clientId: organizationContact?.id,
				valueDate: moment(valueDate).startOf('day').toDate(),
				notes,
				currency,
				isBonus,
				tags,
				employeeId: income.employee?.id ?? null,
				...this.scope()
			});
			this.toastrService.success('NOTES.INCOME.EDIT_INCOME', { name: this.employeeName(income.employee) });
			// Else the refresh would supersede the load of the page now shown, and leave it loading if it failed.
			if (sequence === this.loadSequence) await this.refresh(income.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Opens the income form on a copy of this income, saves it, and opens the copy's own page. */
	async duplicate(): Promise<void> {
		const income = this.income;
		if (!income || this.busy) return;
		const copy = await this.ask<IIncomeFormAnswer>(
			this.dialogService.open(IncomeMutationComponent, { context: { income } }),
			income
		);
		if (!copy) return;
		this.setBusy(true);
		// The page the copy is made from: once it turns (another income or organization) or is left, no navigation.
		const sequence = this.loadSequence;
		try {
			// The form's employee control may be the "All employees" sentinel, which the API rejects:
			// only the resolved id is sent, as the list's add does.
			const { amount, organizationContact, valueDate, employee, notes, currency, isBonus, tags } = copy;
			const created = await this.incomeService.create({
				amount,
				clientId: organizationContact?.id,
				valueDate: moment(valueDate).startOf('day').toDate(),
				employeeId: employee?.id ?? null,
				notes,
				currency,
				isBonus,
				tags,
				...this.scope()
			});
			this.toastrService.success('NOTES.INCOME.ADD_INCOME', { name: this.employeeName(employee) });
			if (created?.id && sequence === this.loadSequence) {
				await this.router.navigate([INCOME_LIST_LINK, 'view', created.id]);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Asks, deletes the income, and goes back to the list. */
	async delete(): Promise<void> {
		const income = this.income;
		if (!income || this.busy) return;
		const dialog = this.dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: this.getTranslation('INCOME_PAGE.INCOME') }
		});
		const confirmed = await this.ask<boolean>(dialog, income);
		if (!confirmed) return;
		this.setBusy(true);
		const sequence = this.loadSequence;
		try {
			await this.incomeService.delete(income.id, { employeeId: income.employeeId, ...this.scope() });
			this.toastrService.success('NOTES.INCOME.DELETE_INCOME', { name: this.employeeName(income.employee) });
			// Not when the page turned or was left while the delete was saving.
			if (sequence === this.loadSequence) await this.router.navigateByUrl(INCOME_LIST_LINK);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.income) return;
		const path = this.router.serializeUrl(this.router.createUrlTree([INCOME_LIST_LINK, 'view', this.income.id]));
		const { origin, pathname, hash } = window.location;
		// The app routes by the hash (`/#/pages/…`); the link keeps to it.
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('INCOME_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Sets the client chart's span; the incomes already read are drawn again, nothing is read. */
	setClientMonths(months: number): void {
		this.clientMonths = months;
		this.describeCharts();
	}

	/** Sets how many payments the payments chart shows at most, as the client chart's span. */
	setClientPayments(payments: number): void {
		this.clientPayments = payments;
		this.describeCharts();
	}

	/** Draws a chart panel as bars or as a line; the amounts stay as read. */
	setChartKind(panel: IncomeChartPanel, kind: ExpenseChartKind): void {
		this.chartKinds = { ...this.chartKinds, [panel]: kind };
	}

	/* ── Reading and describing ── */

	/**
	 * What an action's dialog closes with — or nothing when, by then, the page has turned to another income or
	 * organization (or been left): the answer was given for the income the dialog was opened on, which the page no
	 * longer shows. The page closes such a dialog when it turns.
	 */
	private async ask<T>(dialog: NbDialogRef<unknown>, income: IIncome): Promise<T | null> {
		const sequence = this.loadSequence;
		const organizationId = this.organization?.id;
		this.openDialog = dialog;
		const answer = (await firstValueFrom(dialog.onClose.pipe(first()))) as T;
		if (this.openDialog === dialog) {
			this.openDialog = null;
		}
		const current =
			sequence === this.loadSequence && this.income?.id === income.id && this.organization?.id === organizationId;
		return current && answer ? answer : null;
	}

	/** The actions wait on a save that starts and ends after a dialog closes: the page is drawn again with it. */
	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the income again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.scope();
		// A save that answers after the page turned to another income must not supersede that income's load.
		if (!scope || this.incomeId !== id) return;
		const sequence = ++this.loadSequence;
		try {
			const income = await loadIncome(this.incomeService, id, scope);
			if (sequence !== this.loadSequence || this.incomeId !== id) return;
			if (income) {
				this.show(income);
				// It may have superseded a reload of the same income that had set 'loading'.
				this.state = 'ready';
			} else {
				this.state = 'not-found';
			}
		} catch (error) {
			if (sequence === this.loadSequence) {
				this.errorHandler.handleError(error);
			}
		} finally {
			this.cdr.markForCheck();
		}
	}

	private show(income: IIncome): void {
		this.income = income;
		this.describe();
		void this.loadCharts(income);
	}

	/**
	 * Reads the incomes the charts compare this one with: those of its client over the client chart's longest span,
	 * the client's payments up to it, and all the organization's income in its month. A failed read leaves the rest
	 * of the page as it is; the charts' panels say so.
	 */
	private async loadCharts(income: IIncome): Promise<void> {
		const scope = this.scope();
		const clientId = income.clientId ?? income.client?.id;
		const sequence = ++this.chartsSequence;
		if (!scope || !income.valueDate) {
			this.charts = NO_CHARTS;
			return;
		}
		this.charts = { ...this.charts, loading: true, failed: false };
		// Only the income's currency is charted, so only it is read.
		const where = { ...scope, ...(income.currency ? { currency: income.currency } : {}) };
		const month = moment(income.valueDate);
		try {
			const [client, payments, monthIncomes] = await Promise.all([
				clientId
					? this.readAll({ ...where, clientId, valueDate: categoryReadRange(income) }, sequence)
					: Promise.resolve([]),
				clientId ? this.readClientPayments(income, { ...where, clientId }, sequence) : Promise.resolve([]),
				this.readAll(
					{
						...where,
						valueDate: {
							startDate: month.clone().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
							endDate: month.clone().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
						}
					},
					sequence
				)
			]);
			if (sequence !== this.chartsSequence) return;
			this.clientIncomes = client;
			this.paymentIncomes = payments;
			this.monthIncomes = monthIncomes;
			this.charts = { ...this.charts, loading: false };
			this.describeCharts();
		} catch {
			if (sequence === this.chartsSequence) {
				this.charts = { ...NO_CHARTS, failed: true };
			}
		} finally {
			// The charts answer after the page has been drawn.
			this.cdr.markForCheck();
		}
	}

	/**
	 * Every page of the incomes `where` names: the charts draw sums, so none may be missing. Ordered by date, then
	 * id, so the pages neither overlap nor skip. Stops once a newer read (`sequence` behind `chartsSequence`) owns
	 * the charts: what it has read so far is discarded anyway.
	 */
	private async readAll(where: Record<string, unknown>, sequence: number): Promise<IIncome[]> {
		const incomes: IIncome[] = [];
		for (let page = 1; ; page++) {
			const { items = [], total = 0 } = await this.incomeService.pagination({
				where,
				order: { valueDate: 'ASC', id: 'ASC' },
				skip: page,
				take: CHART_READ_PAGE
			});
			incomes.push(...items);
			if (!items.length || incomes.length >= total || sequence !== this.chartsSequence) {
				return incomes;
			}
		}
	}

	/**
	 * The client payments the chart can show at its largest range, as `vendorPaymentBars` picks them: the latest
	 * ones up to the income — or, when fewer than that come before it, the client's first payments, which run on
	 * past it.
	 */
	private async readClientPayments(
		income: IIncome,
		where: Record<string, unknown>,
		sequence: number
	): Promise<IIncome[]> {
		const take = VENDOR_CHART_READ_PAYMENTS;
		const before = await this.incomeService.pagination({
			where: { ...where, valueDate: vendorReadRange(income) },
			order: { valueDate: 'DESC' },
			take
		});
		// Nor the fallback once a newer read owns the charts, or the page is gone (ngOnDestroy bumps the sequence).
		if ((before.items ?? []).length >= take || sequence !== this.chartsSequence) {
			return before.items ?? [];
		}
		const { items = [] } = await this.incomeService.pagination({ where, order: { valueDate: 'ASC' }, take });
		return items;
	}

	/** Draws the charts from the incomes last read, in the viewer's language. */
	private describeCharts(): void {
		const income = this.income;
		if (!income || this.charts.loading || this.charts.failed) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || 'en';
		const hasClient = !!(income.clientId ?? income.client?.id);
		const share = income.valueDate ? monthShareOf(this.monthIncomes, income) : null;
		const yearBars = hasClient
			? categoryMonthBars(this.clientIncomes, income, locale, CATEGORY_CHART_READ_MONTHS)
			: [];
		this.charts = {
			...this.charts,
			clientBars: hasClient ? categoryMonthBars(this.clientIncomes, income, locale, this.clientMonths) : [],
			paymentBars: hasClient ? vendorPaymentBars(this.paymentIncomes, income, locale, this.clientPayments) : [],
			clientTotal: yearBars.length ? yearBars.reduce((sum, bar) => sum + bar.value, 0) : null,
			share,
			shareMonth: share ? moment(income.valueDate).locale(locale).format('MMMM YYYY') : null
		};
	}

	/** Works out the headline and the sections from the income, in the viewer's language. */
	private describe(): void {
		const income = this.income;
		if (!income) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || 'en';
		this.headline = {
			title: income.client?.name || this.getTranslation('INCOME_PAGE.INCOME'),
			employee: income.employee?.id ? income.employee.fullName?.trim() || null : null,
			since: income.valueDate ? moment(income.valueDate).locale(locale).fromNow() : null
		};

		this.mainSections = [
			{
				title: 'INCOME_VIEW.DESCRIPTION',
				icon: 'file-text-outline',
				fields: [
					{ label: 'SM_TABLE.NOTES', key: 'notes', type: 'multiline', wide: true },
					// The tags as the income dialog's tag picker shows them.
					{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true, tagStyle: 'tinted' }
				]
			}
		];

		// The amount, the type and the date are the headline's figures; the panel lists the rest.
		this.detailsSections = [
			{
				title: 'INCOME_VIEW.DETAILS',
				icon: 'info-outline',
				fields: [
					{ label: 'SM_TABLE.CONTACT', key: 'client.name', icon: 'briefcase-outline' },
					{
						label: 'SM_TABLE.EMPLOYEE',
						key: 'employee',
						type: 'person',
						icon: 'person-outline',
						// The list drops its employee column without this permission; the page does likewise.
						permission: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					},
					{ label: 'SM_TABLE.BONUS', key: 'isBonus', type: 'boolean', icon: 'gift-outline', divider: true },
					{ label: 'INCOME_VIEW.CURRENCY', key: 'currency', icon: 'credit-card-outline' },
					{ label: 'INCOME_VIEW.REFERENCE', key: 'reference', icon: 'hash-outline' }
				]
			}
		];

		this.describeCharts();

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

	/** The organization the page reads in: the one selected in the header. */
	private scope(): IRecordViewScope | null {
		return this.organization
			? { organizationId: this.organization.id, tenantId: this.organization.tenantId }
			: null;
	}

	/** The name the income toasts carry, as the list's: the employee's, else "All employees". */
	private employeeName(employee: Partial<IEmployee> | null | undefined): string {
		return employee?.id && employee.fullName ? employee.fullName.trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}
}
