import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment';
import { BaseEntityEnum, IExpense, IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { ErrorHandlingService, ExpensesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	ALL_EMPLOYEES_SELECTED,
	DeleteConfirmationComponent,
	ExpensesMutationComponent,
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import {
	expenseReceiptOf,
	expenseStatusBadge,
	expenseTaxOf,
	expenseTypeKey,
	formatExpenseMoney,
	loadExpense
} from '../expense-record-view';
import {
	categoryMonthBars,
	categoryReadRange,
	CATEGORY_CHART_MONTHS,
	CATEGORY_CHART_MONTH_OPTIONS,
	IExpenseChartBar,
	IExpenseMonthShare,
	monthShareOf,
	vendorPaymentBars,
	vendorReadRange,
	VENDOR_CHART_PAYMENTS,
	VENDOR_CHART_PAYMENT_OPTIONS,
	VENDOR_CHART_READ_PAYMENTS
} from './expense-view-charts';

/** The page size of the category chart's read: the most the expenses API serves at once. */
const CHART_READ_PAGE = 100;

/** Where the expense page's back button leads, and where a deleted expense's page goes. */
export const EXPENSES_LIST_LINK = '/pages/accounting/expenses';

/** The expense's headline, worked out once per load. */
export interface IExpenseHeadline {
	/** Who was paid — else what it was for. */
	title: string;
	/** The status as the grid's badge colours it: paid green, invoiced amber, otherwise red. */
	status: { text: string; tone: string } | null;
	category: string | null;
	project: string | null;
	contact: string | null;
	/** i18n key of the expense type. */
	typeKey: string | null;
	tax: { rate: string; label: string | null } | null;
	/** How long ago the expense was made, e.g. "3 days ago". */
	since: string | null;
}

/** The charts: the expenses they compare this one with, and what is drawn from them. */
export interface IExpenseCharts {
	loading: boolean;
	failed: boolean;
	/** The category's spending per month, ending with this expense's month. */
	categoryBars: IExpenseChartBar[];
	/** The payments to the vendor, this one among them. */
	vendorBars: IExpenseChartBar[];
	/** This expense against the rest of its category in its month. */
	share: IExpenseMonthShare | null;
	/** The month the share is of, e.g. "March 2026". */
	shareMonth: string | null;
}

const NO_CHARTS: IExpenseCharts = {
	loading: false,
	failed: false,
	categoryBars: [],
	vendorBars: [],
	share: null,
	shareMonth: null
};

/**
 * An expense on its own full-width page, `/pages/accounting/expenses/view/:id` (handover §4.P): what an expense
 * favorite in the sidebar opens, and where the expense drawer's "expand to full width" icon leads.
 *
 * Laid out as Jira's issue page, with the facts Hubstaff puts on an expense: the actions — Edit, Duplicate, Copy
 * link, the star and Delete — beside the back button; the headline — who was paid, the status, the category and
 * the project, then the amount, the tax, the type and the date as figures; the record in the wide column — what it
 * was for, the notes, the tags and the receipt, then how it compares: its category's spending by month and the
 * payments to its vendor; and the facts in the side column — the details, its share of its month, then the stamps.
 *
 * The page belongs to the organization selected in the header, like the expenses list: an expense of another
 * organization reads "not found", and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-view-page',
	templateUrl: './expense-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./expense-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	// The project page's page layout: headline, then two columns.
	host: { class: 'is-page' }
})
export class ExpenseViewPageComponent extends TranslationBaseComponent implements OnInit {
	readonly PermissionsEnum = PermissionsEnum;
	readonly favoriteEntity = BaseEntityEnum.Expense;
	readonly backLink = EXPENSES_LIST_LINK;

	/** The expense as read: what the edit dialog is opened on. */
	expense: IExpense = null;
	/** The expense with the grid's status badge, for the record sections. */
	record: any = null;
	headline: IExpenseHeadline = null;
	receipt: { url: string; isImage: boolean } | null = null;
	/** An image receipt that failed to load: the panel offers the file as a link instead. */
	receiptBroken = false;

	/** What it was for, the notes and the tags, in the wide column. */
	mainSections: IRecordViewSection[] = [];
	/** The details, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];

	/** The category, vendor and month charts, read after the expense itself. */
	charts: IExpenseCharts = NO_CHARTS;
	/** The category chart's span in months, and the payments the vendor chart shows at most: the panels' filters. */
	categoryMonths = CATEGORY_CHART_MONTHS;
	vendorPayments = VENDOR_CHART_PAYMENTS;
	readonly categoryMonthOptions = CATEGORY_CHART_MONTH_OPTIONS;
	readonly vendorPaymentOptions = VENDOR_CHART_PAYMENT_OPTIONS;
	/** Formats a chart's amount in the expense's currency. */
	readonly formatAmount = (value: number): string =>
		formatExpenseMoney(value, this.expense?.currency, this.translateService.getCurrentLang() || undefined);

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit, a duplicate or a delete is being saved: the actions wait for it. */
	busy = false;

	private expenseId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/** The same for the charts' reads, which answer after the expense's. */
	private chartsSequence = 0;
	/** The expenses of this one's category and of its vendor, as the charts last read them. */
	private categoryExpenses: IExpense[] = [];
	private vendorExpenses: IExpense[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly expensesService: ExpensesService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly store: Store,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

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
				this.expenseId = id;
				this.organization = organization;
				void this.load();
			});
		// The type, the status and "3 days ago" are worked out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	/** Loads (or reloads, after an error) the expense the URL names. */
	async load(): Promise<void> {
		const id = this.expenseId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// The previous expense's chart reads are discarded too: answering now, they would refill what is cleared here.
		this.chartsSequence++;
		// Nothing of the previous expense stays on screen while this one loads or if it fails.
		this.expense = null;
		this.record = null;
		this.headline = null;
		this.charts = NO_CHARTS;
		this.categoryExpenses = [];
		this.vendorExpenses = [];
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const expense = await loadExpense(this.expensesService, id, scope);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!expense || (expense.organizationId && expense.organizationId !== scope.organizationId)) {
				throw { status: 404 };
			}
			this.show(expense);
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

	/** Opens the expense form the list edits with, then saves what it answers and reads the expense again. */
	async edit(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const dialog = this.dialogService.open(ExpensesMutationComponent, { context: { expense } });
		const edited: IExpense = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!edited || this.expense?.id !== expense.id) return;
		const scope = this.scope();
		this.setBusy(true);
		try {
			// As the list saves it: the expense's own employee, not the form's employee control.
			const payload: any = { ...edited };
			delete payload.employee;
			await this.expensesService.update(expense.id, {
				...payload,
				valueDate: moment(edited.valueDate).startOf('day').toDate(),
				employeeId: expense.employee?.id ?? null,
				...scope
			});
			this.toastrService.success('NOTES.EXPENSES.OPEN_EDIT_EXPENSE_DIALOG', { name: this.employeeName(expense.employee) });
			await this.refresh(expense.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Opens the expense form on a copy of this expense, saves it, and opens the copy's own page. */
	async duplicate(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const dialog = this.dialogService.open(ExpensesMutationComponent, { context: { expense, duplicate: true } });
		const copy: IExpense = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!copy) return;
		const scope = this.scope();
		this.setBusy(true);
		try {
			// The form's employee control may be the "All employees" sentinel, which the API rejects:
			// only the resolved id is sent, as the list's add does.
			const { employee } = copy;
			const payload: any = { ...copy };
			delete payload.employee;
			const created = await this.expensesService.create({
				...payload,
				valueDate: moment(copy.valueDate).startOf('day').toDate(),
				employeeId: employee?.id ?? null,
				...scope
			});
			this.toastrService.success('NOTES.EXPENSES.ADD_EXPENSE', { name: this.employeeName(employee) });
			if (created?.id) {
				await this.router.navigate([EXPENSES_LIST_LINK, 'view', created.id]);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Asks, deletes the expense, and goes back to the list. */
	async delete(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const dialog = this.dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: this.getTranslation('FORM.DELETE_CONFIRMATION.EXPENSE') }
		});
		const confirmed = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!confirmed) return;
		this.setBusy(true);
		try {
			await this.expensesService.delete(expense.id, { employeeId: expense.employeeId, ...this.scope() });
			this.toastrService.success('NOTES.EXPENSES.DELETE_EXPENSE', { name: this.employeeName(expense.employee) });
			await this.router.navigateByUrl(EXPENSES_LIST_LINK);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.expense) return;
		const path = this.router.serializeUrl(this.router.createUrlTree([EXPENSES_LIST_LINK, 'view', this.expense.id]));
		const { origin, pathname, hash } = window.location;
		// The app routes by the hash (`/#/pages/…`); the link keeps to it.
		const url = hash.startsWith('#/') ? `${origin}${pathname}#${path}` : `${origin}${path}`;
		try {
			await navigator.clipboard.writeText(url);
			this.toastrService.success('EXPENSE_VIEW.LINK_COPIED');
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/** Sets the category chart's span; the expenses already read are drawn again, nothing is read. */
	setCategoryMonths(months: number): void {
		this.categoryMonths = months;
		this.describeCharts();
	}

	/** Sets how many payments the vendor chart shows at most, as the category's span. */
	setVendorPayments(payments: number): void {
		this.vendorPayments = payments;
		this.describeCharts();
	}

	/* ── Reading and describing ── */

	/** The actions wait on a save that starts and ends after a dialog closes: the page is drawn again with it. */
	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the expense again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.scope();
		const sequence = ++this.loadSequence;
		try {
			const expense = await loadExpense(this.expensesService, id, scope);
			if (sequence !== this.loadSequence || this.expenseId !== id) return;
			if (expense) {
				this.show(expense);
			} else {
				this.state = 'not-found';
			}
		} catch (error) {
			if (sequence === this.loadSequence) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private show(expense: IExpense): void {
		this.expense = expense;
		this.record = { ...expense, statuses: expenseStatusBadge(expense.status) };
		this.receipt = expenseReceiptOf(expense);
		this.receiptBroken = false;
		this.describe();
		void this.loadCharts(expense);
	}

	/**
	 * Reads the expenses the charts compare this one with: those of its category and those of its vendor. A failed
	 * read leaves the rest of the page as it is; the charts' panels say so.
	 */
	private async loadCharts(expense: IExpense): Promise<void> {
		const scope = this.scope();
		const categoryId = expense.categoryId ?? expense.category?.id;
		const vendorId = expense.vendorId ?? expense.vendor?.id;
		const sequence = ++this.chartsSequence;
		if (!scope || (!categoryId && !vendorId)) {
			this.charts = NO_CHARTS;
			return;
		}
		this.charts = { ...this.charts, loading: true, failed: false };
		// Only the expense's currency is charted, so only it is read.
		const where = { ...scope, ...(expense.currency ? { currency: expense.currency } : {}) };
		try {
			const [category, vendor] = await Promise.all([
				categoryId ? this.readCategoryExpenses(expense, { ...where, categoryId }, sequence) : Promise.resolve([]),
				vendorId ? this.readVendorPayments(expense, { ...where, vendorId }) : Promise.resolve([])
			]);
			if (sequence !== this.chartsSequence) return;
			this.categoryExpenses = category;
			this.vendorExpenses = vendor;
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
	 * The category's expenses over the longest span the range filter offers, every page of them: the bars are
	 * sums, so none may be missing. Ordered by date, then id, so the pages neither overlap nor skip. Stops once a
	 * newer read (`sequence` behind `chartsSequence`) owns the charts: what it has read so far is discarded anyway.
	 */
	private async readCategoryExpenses(
		expense: IExpense,
		where: Record<string, unknown>,
		sequence: number
	): Promise<IExpense[]> {
		const valueDate = categoryReadRange(expense);
		if (!valueDate) {
			return [];
		}
		const expenses: IExpense[] = [];
		for (let page = 1; ; page++) {
			const { items = [], total = 0 } = await this.expensesService.pagination({
				where: { ...where, valueDate },
				order: { valueDate: 'ASC', id: 'ASC' },
				skip: page,
				take: CHART_READ_PAGE
			});
			expenses.push(...items);
			if (!items.length || expenses.length >= total || sequence !== this.chartsSequence) {
				return expenses;
			}
		}
	}

	/**
	 * The vendor payments the chart can show at its largest range, as `vendorPaymentBars` picks them: the latest
	 * ones up to the expense — or, when fewer than that come before it, the vendor's first payments, which run on
	 * past it. None for an expense without a date, which has no place among them.
	 */
	private async readVendorPayments(expense: IExpense, where: Record<string, unknown>): Promise<IExpense[]> {
		const valueDate = vendorReadRange(expense);
		if (!valueDate) {
			return [];
		}
		const take = VENDOR_CHART_READ_PAYMENTS;
		const before = await this.expensesService.pagination({
			where: { ...where, valueDate },
			order: { valueDate: 'DESC' },
			take
		});
		if ((before.items ?? []).length >= take) {
			return before.items;
		}
		const { items = [] } = await this.expensesService.pagination({ where, order: { valueDate: 'ASC' }, take });
		return items;
	}

	/** Draws the charts from the expenses last read, in the viewer's language. */
	private describeCharts(): void {
		const expense = this.expense;
		if (!expense || this.charts.loading || this.charts.failed) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || 'en';
		const hasCategory = !!(expense.categoryId ?? expense.category?.id);
		const hasVendor = !!(expense.vendorId ?? expense.vendor?.id);
		const share = hasCategory ? monthShareOf(this.categoryExpenses, expense) : null;
		this.charts = {
			...this.charts,
			categoryBars: hasCategory ? categoryMonthBars(this.categoryExpenses, expense, locale, this.categoryMonths) : [],
			vendorBars: hasVendor ? vendorPaymentBars(this.vendorExpenses, expense, locale, this.vendorPayments) : [],
			share,
			shareMonth: share ? moment(expense.valueDate).locale(locale).format('MMMM YYYY') : null
		};
	}

	/** Works out the headline and the sections from the expense, in the viewer's language. */
	private describe(): void {
		const expense = this.expense;
		if (!expense) {
			return;
		}
		const locale = this.translateService.getCurrentLang();
		const badge = expenseStatusBadge(expense.status);
		this.headline = {
			title: expense.vendor?.name || expense.category?.name || this.getTranslation('EXPENSE_VIEW.EXPENSE'),
			status: badge
				? {
						text: this.statusText(expense.status),
						tone: badge.class
				  }
				: null,
			category: expense.category?.name || null,
			project: expense.project?.name || null,
			contact: expense.organizationContact?.name || null,
			typeKey: expenseTypeKey(expense.typeOfExpense),
			tax: expenseTaxOf(expense, locale),
			since: expense.valueDate ? moment(expense.valueDate).locale(locale || 'en').fromNow() : null
		};

		this.mainSections = [
			{
				title: 'EXPENSE_VIEW.DESCRIPTION',
				icon: 'file-text-outline',
				fields: [
					{ label: 'POP_UPS.PURPOSE', key: 'purpose', type: 'multiline', wide: true },
					{ label: 'SM_TABLE.NOTES', key: 'notes', type: 'multiline', wide: true },
					{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }
				]
			}
		];

		// The amount, the tax, the type and the date are the headline's figures; the panel lists the rest.
		this.detailsSections = [
			{
				title: 'EXPENSE_VIEW.DETAILS',
				icon: 'info-outline',
				fields: [
					{ label: 'SM_TABLE.STATUS', key: 'statuses', type: 'badge', icon: 'radio-button-on-outline' },
					{ label: 'SM_TABLE.VENDOR', key: 'vendor.name', icon: 'shopping-bag-outline', divider: true },
					{ label: 'SM_TABLE.CATEGORY', key: 'category.name', icon: 'pricetags-outline' },
					{ label: 'SM_TABLE.PROJECT', key: 'project.name', icon: 'folder-outline', divider: true },
					{ label: 'SM_TABLE.CONTACT', key: 'organizationContact.name', icon: 'briefcase-outline' },
					{
						label: 'SM_TABLE.EMPLOYEE',
						key: 'employee',
						type: 'person',
						icon: 'person-outline',
						// The list drops its employee column without this permission; the page does likewise.
						permission: PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					},
					{
						label: 'EXPENSES_PAGE.SPLIT_EXPENSE',
						key: 'splitExpense',
						type: 'boolean',
						icon: 'people-outline'
					}
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

	/** The status in the viewer's language, as the expense form lists it. */
	private statusText(status: string): string {
		const key = `EXPENSES_PAGE.MUTATION.${status}`;
		const text = this.getTranslation(key);
		return text && text !== key ? text : String(status).replace(/_/g, ' ');
	}

	/** The organization the page reads in: the one selected in the header. */
	private scope(): IRecordViewScope | null {
		return this.organization ? { organizationId: this.organization.id, tenantId: this.organization.tenantId } : null;
	}

	/** The name the expense toasts carry, as the list's: the employee's, else "All employees". */
	private employeeName(employee: IExpense['employee']): string {
		return employee?.id && employee.fullName ? employee.fullName.trim() : ALL_EMPLOYEES_SELECTED.firstName;
	}
}
