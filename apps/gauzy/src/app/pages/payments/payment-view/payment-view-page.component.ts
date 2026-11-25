import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment';
import {
	BaseEntityEnum,
	IInvoice,
	IInvoiceEstimateHistory,
	IOrganization,
	IPayment,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ErrorHandlingService,
	InvoiceEstimateHistoryService,
	PaymentService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DeleteConfirmationComponent,
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import { PaymentMutationComponent } from '../../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { InvoicePaymentReceiptMutationComponent } from '../../invoices/invoice-payments/payment-receipt-mutation/payment-receipt-mutation.component';
import { formatExpenseMoney } from '../../expenses/expense-record-view';
import {
	IExpenseChartBar,
	IExpenseMonthShare,
	categoryMonthBars,
	monthShareOf
} from '../../expenses/expense-view/expense-view-charts';
import {
	INVOICE_VIEW_LINK,
	PAYMENTS_LIST_LINK,
	PAYMENT_CHART_MONTHS,
	PAYMENT_CHART_MONTH_OPTIONS,
	PAYMENT_META_SECTIONS,
	buildPaymentDetailsSections,
	loadInvoiceActivity,
	loadInvoicePayments,
	loadOrganizationPayments,
	loadPayment,
	paymentChartRecord,
	paymentContactId,
	paymentContactName,
	paymentDaysFromDue,
	paymentNeighbours
} from '../payment-record-view';

/** The class the page puts on the document's body while it prints: its print styles hide the app around it. */
const PRINTING_CLASS = 'payment-printing';

/** The payment's headline, worked out once per payment. */
export interface IPaymentHeadline {
	/** "Payment from Acme", or "Payment" when it names no contact. */
	title: string;
	/** i18n key of its status: on time or overdue. */
	statusKey: string;
	tone: 'success' | 'danger';
	/** i18n key of its payment method, `null` when none was picked. */
	methodKey: string | null;
	/**
	 * When it was paid against the invoice's due date, e.g. "Paid 5 days before due"; without a due date, how long ago,
	 * by calendar day: "Today", "3 days ago".
	 */
	timing: string | null;
	/** Paid after the invoice's due date. */
	late: boolean;
	/** The payment date written out in full, e.g. "Wednesday, November 25, 2026": the date's tooltip. */
	dateTitle: string | null;
}

/** One payment of the invoice, as the page's table lists it. */
export interface IInvoicePaymentRow {
	payment: IPayment;
	/** The payment the page is about. */
	isCurrent: boolean;
}

/** The invoice the payment pays, and how much of it is paid. */
export interface IPaymentInvoiceSummary {
	invoice: IInvoice;
	total: number;
	paid: number;
	balance: number;
	paidInFull: boolean;
	/** How much of the total is paid, 0 to 100: the progress bar's width. */
	percent: number;
	/** Payments counted in `paid`; `null` while they are read, or when they could not be. */
	count: number | null;
}

/** One change of the invoice, as the activity panel lists it. */
export interface IPaymentActivityItem {
	id: string;
	/** What was done, as it was written when it was done, e.g. "Payment of 100 USD added". */
	action: string;
	/** Who did it. */
	user: string | null;
	/** When, e.g. "2 hours ago". */
	when: string | null;
	/** When, in full: the time's tooltip. */
	whenTitle: string | null;
}

/** The invoice's latest changes. */
export interface IPaymentActivity {
	loading: boolean;
	failed: boolean;
	items: IPaymentActivityItem[];
}

const NO_ACTIVITY: IPaymentActivity = { loading: false, failed: false, items: [] };

/** The charts: the contact's payments month by month, and this payment's share of its month's payments. */
export interface IPaymentCharts {
	loading: boolean;
	failed: boolean;
	/** One bar per month, ending with the payment's month. */
	monthBars: IExpenseChartBar[];
	share: IExpenseMonthShare | null;
	/** The payment's month in the viewer's language, e.g. "November 2026". */
	month: string | null;
	/** The contact the monthly chart is about, `null` when the payment names none and the chart counts every payment. */
	contact: string | null;
}

const NO_CHARTS: IPaymentCharts = { loading: false, failed: false, monthBars: [], share: null, month: null, contact: null };

/** Where an edit or a delete started, so its answer can tell whether the page is still the one it changed. */
interface ActionOrigin {
	paymentId: string;
	organizationId: string;
	organization: IOrganization;
	scope: IRecordViewScope;
	/** The page's load when the action started. */
	generation: number;
}

/**
 * A payment on its own full-width page, `/pages/accounting/payments/view/:id`: what the payments list's View button
 * and a payment's sidebar favorite open.
 *
 * Laid out as the recurring expense page: the actions — previous / next payment, Edit, Send receipt, Print, Copy
 * link, the favorite star and Delete — beside the back button; the headline across the top (who paid, its status, method and project, then the amount, the date,
 * the invoice and who recorded it as figures); the invoice it pays, every payment of that invoice and the contact's
 * payments month by month in the wide column; the details, its share of the month's payments, the invoice's latest
 * activity and the stamps in the side one.
 *
 * Keys, when no field, dialog or menu has the focus: E edits, C copies the link, J / K open the next / previous
 * payment. Esc is left to the app's menus and panels, which close on it.
 *
 * The page belongs to the organization selected in the header: a payment of another organization reads "not found",
 * and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payment-view-page',
	templateUrl: './payment-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./payment-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	// The project quick look's page layout: the headline across the top, then two columns.
	host: { class: 'is-page' }
})
export class PaymentViewPageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	readonly PermissionsEnum = PermissionsEnum;
	readonly BaseEntityEnum = BaseEntityEnum;
	readonly backLink = PAYMENTS_LIST_LINK;
	readonly invoiceViewLink = INVOICE_VIEW_LINK;
	/** The invoices' own page asks for one of these. */
	readonly invoiceViewPermissions = [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW];
	/** The invoice's history is read with this one alone: the history's read asks for it, not for the org-wide view. */
	readonly invoiceActivityPermissions = [PermissionsEnum.INVOICES_VIEW];
	readonly metaSections: IRecordViewSection[] = PAYMENT_META_SECTIONS;

	/** The payment as read: what the edit dialog is opened on, and what the page shows. */
	payment: IPayment = null;
	headline: IPaymentHeadline = null;
	detailsSections: IRecordViewSection[] = [];

	/** The invoice the payment pays, `null` when it pays none. */
	invoiceSummary: IPaymentInvoiceSummary = null;
	/** Every payment of that invoice, oldest first, this one among them. */
	invoicePayments: IInvoicePaymentRow[] = [];
	invoicePaymentsLoading = false;
	invoicePaymentsFailed = false;

	/** The invoice's latest changes. */
	activity: IPaymentActivity = NO_ACTIVITY;
	/** The payments either side of this one, by payment date. */
	previousPayment: IPayment | null = null;
	nextPayment: IPayment | null = null;

	/** The contact's payments month by month, and this payment's share of its month. */
	charts: IPaymentCharts = NO_CHARTS;
	/** The monthly chart's span in months: its range filter. */
	chartMonths = PAYMENT_CHART_MONTHS;
	readonly chartMonthOptions = PAYMENT_CHART_MONTH_OPTIONS;
	/** Formats a chart's amount in the payment's currency. */
	readonly formatAmount = (value: number): string =>
		formatExpenseMoney(value, this.payment?.currency, this.translateService.getCurrentLang() || undefined);

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit or a delete is being saved: the actions wait for it. */
	busy = false;

	private paymentId: string = null;
	private viewScope: IRecordViewScope = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/** The same for the read of the invoice's payments. */
	private invoicePaymentsSequence = 0;
	/** The same for the charts' read. */
	private chartsSequence = 0;
	/** The organization's payments the charts are drawn from, as last read. */
	private organizationPayments: IPayment[] = [];
	/** The same for the read of the invoice's activity. */
	private activitySequence = 0;
	/** The invoice's changes as read, described again in a new language. */
	private activityRecords: IInvoiceEstimateHistory[] = [];

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly paymentService: PaymentService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
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
				this.paymentId = id;
				this.organization = organization;
				this.viewScope = { organizationId: organization.id, tenantId: organization.tenantId };
				void this.load();
			});
		// The title, the method and "3 days ago" are worked out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	/** Loads (or reloads, after an error) the payment the URL names. */
	async load(): Promise<void> {
		const id = this.paymentId;
		const scope = this.viewScope;
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous payment stays on screen while this one loads or if it fails.
		this.show(null);
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const payment = await loadPayment(this.paymentService, id, scope);
			if (sequence !== this.loadSequence) {
				return; // a newer navigation or organization switch owns the page
			}
			if (!payment || (payment.organizationId && payment.organizationId !== scope.organizationId)) {
				throw { status: 404 };
			}
			this.show(payment);
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

	ngOnDestroy(): void {
		document.body.classList.remove(PRINTING_CLASS);
	}

	/**
	 * The receipt is e-mailed to the contact the invoice was sent to, at its primary e-mail, signed with the
	 * organization it is from: without either there is no one to send it to, or no one to send it from.
	 */
	get canSendReceipt(): boolean {
		const invoice = this.payment?.invoice;
		return !!invoice?.toContact?.primaryEmail && !!invoice.fromOrganization;
	}

	/* ── Keys and printing ── */

	/** The page's keys; none while the viewer types, or while a dialog or a menu is open. */
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (
			!this.payment ||
			this.busy ||
			event.defaultPrevented ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.shiftKey
		) {
			return;
		}
		const target = event.target as HTMLElement | null;
		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
			return;
		}
		if (document.querySelector('.cdk-overlay-backdrop')) {
			return;
		}
		switch ((event.key || '').toLowerCase()) {
			case 'e':
				if (this.store.hasAnyPermission(PermissionsEnum.ORG_PAYMENT_ADD_EDIT)) {
					event.preventDefault();
					void this.edit();
				}
				break;
			case 'c':
				event.preventDefault();
				void this.copyLink();
				break;
			case 'j':
				event.preventDefault();
				this.openPayment(this.nextPayment);
				break;
			case 'k':
				event.preventDefault();
				this.openPayment(this.previousPayment);
				break;
		}
	}

	/** Prints the page as a receipt: its print styles keep the payment and the invoice, and hide the rest. */
	print(): void {
		window.print();
	}

	/** Printing from the button or the browser's own menu: the app around the page is hidden while it prints. */
	@HostListener('window:beforeprint')
	onBeforePrint(): void {
		document.body.classList.add(PRINTING_CLASS);
	}

	@HostListener('window:afterprint')
	onAfterPrint(): void {
		document.body.classList.remove(PRINTING_CLASS);
	}

	/** Opens another payment's page: the previous or the next one. */
	openPayment(payment: IPayment | null): void {
		if (payment) {
			void this.router.navigate(this.paymentLink(payment));
		}
	}

	/** Sets the monthly chart's span; the payments already read are drawn again, nothing is read. */
	setChartMonths(months: number): void {
		this.chartMonths = months;
		this.describeCharts();
	}

	/** The link of a payment of the invoice: its own page. */
	paymentLink(payment: IPayment): string[] {
		return [PAYMENTS_LIST_LINK, 'view', payment.id];
	}

	/** The i18n key of a payment's method, `null` when none was picked. */
	methodKeyOf(payment: IPayment): string | null {
		return payment?.paymentMethod ? `INVOICES_PAGE.PAYMENTS.${payment.paymentMethod}` : null;
	}

	/* ── Actions ── */

	/** Opens the form the list edits with, saves what it answers and notes the change in the invoice's history. */
	async edit(): Promise<void> {
		const payment = this.payment;
		if (!payment || this.busy) return;
		const origin = this.actionOrigin();
		const dialog = this.dialogService.open(PaymentMutationComponent, {
			context: { payment, invoice: payment.invoice }
		});
		const edited = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!edited || !this.isStillOn(origin)) return;
		this.setBusy(true);
		try {
			const saved = await this.paymentService.update(payment.id, edited);
			const invoice: IInvoice = edited.invoice ?? saved?.invoice ?? payment.invoice;
			if (invoice) {
				await this.createInvoiceHistory(this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT'), invoice, origin);
			}
			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
			// The viewer moved to another payment or organization while it saved: the page is theirs now.
			if (!this.isStillOn(origin)) return;
			await this.refresh(payment.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/**
	 * Records another payment of the invoice with the form the lists record with, then notes it in the invoice's
	 * history. The page stays on this payment; its invoice's figures and table take the new one in.
	 */
	async recordPayment(): Promise<void> {
		const payment = this.payment;
		const invoice = payment?.invoice;
		if (!invoice || this.busy) return;
		const origin = this.actionOrigin();
		const result: IPayment = await firstValueFrom(
			this.dialogService.open(PaymentMutationComponent, { context: { invoice } }).onClose.pipe(first())
		);
		if (!result || !this.isStillOn(origin)) return;
		this.setBusy(true);
		try {
			const saved = await this.paymentService.add(result);
			const target: IInvoice = result.invoice ?? saved?.invoice ?? invoice;
			const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', {
				amount: saved?.amount ?? result.amount,
				currency: saved?.currency ?? result.currency
			});
			await this.createInvoiceHistory(action, target, origin);
			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD');
			if (!this.isStillOn(origin)) return;
			await this.refresh(payment.id);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/**
	 * Sends the payment's receipt to the contact the invoice was sent to, with the invoice page's dialog. The dialog
	 * answers what the send answered: `true` sent, `false` the mail could not be sent; nothing when it was cancelled.
	 */
	async sendReceipt(): Promise<void> {
		const payment = this.payment;
		if (!payment || !this.canSendReceipt || this.busy) return;
		const invoice = payment.invoice;
		const sent: boolean | undefined = await firstValueFrom(
			this.dialogService
				.open(InvoicePaymentReceiptMutationComponent, { context: { invoice, payment } })
				.onClose.pipe(first())
		);
		if (sent === true) {
			this.toastrService.success('PAYMENT_VIEW.RECEIPT_SENT', { name: invoice.toContact.name });
		} else if (sent === false) {
			this.toastrService.danger('PAYMENT_VIEW.RECEIPT_NOT_SENT');
		}
	}

	/**
	 * Asks before deleting, naming the payment by its amount and who paid it, then notes the removal in the invoice's
	 * history and goes back to the list.
	 */
	async delete(): Promise<void> {
		const payment = this.payment;
		if (!payment || this.busy) return;
		const origin = this.actionOrigin();
		const confirmed = await firstValueFrom(
			this.dialogService
				.open(DeleteConfirmationComponent, { context: { recordType: this.paymentName(payment) } })
				.onClose.pipe(first())
		);
		if (!confirmed || !this.isStillOn(origin)) return;
		this.setBusy(true);
		try {
			await this.paymentService.delete(payment.id);
			if (payment.invoice) {
				await this.createInvoiceHistory(
					this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE'),
					payment.invoice,
					origin
				);
			}
			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
			// The viewer moved to another payment or organization while it deleted: the page is theirs now.
			if (!this.isStillOn(origin)) return;
			await this.router.navigateByUrl(PAYMENTS_LIST_LINK);
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.payment) return;
		const path = this.router.serializeUrl(this.router.createUrlTree(this.paymentLink(this.payment)));
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

	/* ── Reading and describing ── */

	/** Draws the payment and reads the invoice's other payments; nothing of a previous payment stays. */
	private show(payment: IPayment | null): void {
		this.invoicePaymentsSequence++;
		this.chartsSequence++;
		this.payment = payment;
		this.invoicePayments = [];
		this.invoicePaymentsLoading = false;
		this.invoicePaymentsFailed = false;
		this.organizationPayments = [];
		this.charts = NO_CHARTS;
		this.activitySequence++;
		this.activityRecords = [];
		this.activity = NO_ACTIVITY;
		this.previousPayment = null;
		this.nextPayment = null;
		this.describe();
		if (payment?.invoice?.id) {
			void this.loadInvoicePayments(payment);
			if (this.store.hasAnyPermission(...this.invoiceActivityPermissions)) {
				void this.loadActivity(payment);
			}
		}
		if (payment?.paymentDate) {
			void this.loadCharts(payment);
		}
	}

	/** Reads the invoice's latest changes. A failed read leaves the rest as it is; the panel says so. */
	private async loadActivity(payment: IPayment): Promise<void> {
		const scope = this.viewScope;
		if (!scope) return;
		const sequence = ++this.activitySequence;
		this.activity = { ...NO_ACTIVITY, loading: true };
		try {
			const records = await loadInvoiceActivity(this.invoiceEstimateHistoryService, payment.invoice.id, scope);
			if (sequence !== this.activitySequence) return;
			this.activityRecords = records;
			this.activity = { ...NO_ACTIVITY };
			this.describeActivity();
		} catch {
			if (sequence === this.activitySequence) {
				this.activity = { ...NO_ACTIVITY, failed: true };
			}
		} finally {
			if (sequence === this.activitySequence) {
				this.cdr.markForCheck();
			}
		}
	}

	/** Describes the invoice's changes read, in the viewer's language. */
	private describeActivity(): void {
		if (this.activity.loading || this.activity.failed) return;
		const locale = this.translateService.getCurrentLang() || 'en';
		this.activity = {
			...this.activity,
			items: this.activityRecords.map((record) => ({
				id: record.id,
				action: record.action,
				user: record.user?.name ?? null,
				when: record.createdAt ? moment(record.createdAt).locale(locale).fromNow() : null,
				whenTitle: record.createdAt ? moment(record.createdAt).locale(locale).format('LLLL') : null
			}))
		};
	}

	/**
	 * Reads the organization's payments the charts are drawn from. A failed read leaves the rest as it is; the charts'
	 * panels say so.
	 */
	private async loadCharts(payment: IPayment): Promise<void> {
		const scope = this.viewScope;
		if (!scope) return;
		const sequence = ++this.chartsSequence;
		this.charts = { ...NO_CHARTS, loading: true };
		this.describeCharts();
		try {
			const payments = await loadOrganizationPayments(this.paymentService, scope);
			if (sequence !== this.chartsSequence) return;
			this.organizationPayments = payments;
			this.charts = { ...this.charts, loading: false };
			this.describeCharts();
		} catch {
			if (sequence === this.chartsSequence) {
				this.charts = { ...NO_CHARTS, failed: true };
			}
		} finally {
			if (sequence === this.chartsSequence) {
				this.cdr.markForCheck();
			}
		}
	}

	/**
	 * Draws the charts from the payments read, in the viewer's language: the months of the payments from the same
	 * contact (every payment when it names none), and the payment against every payment received in its month. Only
	 * payments in its currency are added up; the payment itself counts as the page read it.
	 */
	private describeCharts(): void {
		const payment = this.payment;
		if (!payment?.paymentDate || this.charts.failed) {
			return;
		}
		const locale = this.translateService.getCurrentLang() || 'en';
		const contactId = paymentContactId(payment);
		const fromContact = contactId
			? this.organizationPayments.filter((item) => paymentContactId(item) === contactId)
			: this.organizationPayments;
		const self = paymentChartRecord(payment);
		if (!this.charts.loading) {
			const { previous, next } = paymentNeighbours(this.organizationPayments, payment);
			this.previousPayment = previous;
			this.nextPayment = next;
		}
		this.charts = {
			...this.charts,
			monthBars: categoryMonthBars(fromContact.map(paymentChartRecord), self, locale, this.chartMonths),
			share: this.charts.loading ? null : monthShareOf(this.organizationPayments.map(paymentChartRecord), self),
			month: moment(payment.paymentDate).locale(locale).format('MMMM YYYY'),
			contact: contactId ? paymentContactName(payment) : null
		};
	}

	/** Reads every payment of the payment's invoice. A failed read leaves the rest as it is; the table says so. */
	private async loadInvoicePayments(payment: IPayment): Promise<void> {
		const scope = this.viewScope;
		const sequence = ++this.invoicePaymentsSequence;
		this.invoicePayments = [{ payment, isCurrent: true }];
		if (!scope) return;
		this.invoicePaymentsLoading = true;
		try {
			const payments = await loadInvoicePayments(this.paymentService, payment.invoice.id, scope);
			if (sequence !== this.invoicePaymentsSequence) return;
			const list = payments.some((item) => item.id === payment.id) ? payments : [...payments, payment];
			this.invoicePayments = list.map((item) => ({ payment: item, isCurrent: item.id === payment.id }));
			this.describeInvoice(list.length);
		} catch {
			if (sequence === this.invoicePaymentsSequence) {
				this.invoicePaymentsFailed = true;
			}
		} finally {
			if (sequence === this.invoicePaymentsSequence) {
				this.invoicePaymentsLoading = false;
				this.cdr.markForCheck();
			}
		}
	}

	/** Works out the headline, the invoice's figures and the details from the payment, in the viewer's language. */
	private describe(): void {
		const payment = this.payment;
		if (!payment) {
			this.headline = null;
			this.invoiceSummary = null;
			this.detailsSections = [];
			return;
		}
		const locale = this.translateService.getCurrentLang() || 'en';
		const contact = paymentContactName(payment);
		this.headline = {
			title: contact
				? this.getTranslation('PAYMENT_VIEW.FROM_CONTACT', { contact })
				: this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT'),
			statusKey: payment.overdue ? 'INVOICES_PAGE.PAYMENTS.OVERDUE' : 'INVOICES_PAGE.PAYMENTS.ON_TIME',
			tone: payment.overdue ? 'danger' : 'success',
			methodKey: this.methodKeyOf(payment),
			...this.timingOf(payment, locale)
		};
		this.describeInvoice(this.invoicePaymentsLoading || this.invoicePaymentsFailed ? null : this.invoicePayments.length || null);
		this.detailsSections = buildPaymentDetailsSections(payment, {
			contact: this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW),
			project: this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		});
		this.describeCharts();
		this.describeActivity();
	}

	/**
	 * When the payment was made: against the invoice's due date when it has one, otherwise how long ago by calendar
	 * day, so a payment of today reads "Today", not "in an hour".
	 */
	private timingOf(payment: IPayment, locale: string): Pick<IPaymentHeadline, 'timing' | 'late' | 'dateTitle'> {
		if (!payment.paymentDate) {
			return { timing: null, late: false, dateTitle: null };
		}
		const date = moment(payment.paymentDate).locale(locale);
		const dateTitle = date.format('dddd, LL');
		const days = paymentDaysFromDue(payment);
		if (days !== null) {
			const count = Math.abs(days);
			let key = 'PAYMENT_VIEW.PAID_ON_DUE_DATE';
			if (days < 0) {
				key = count === 1 ? 'PAYMENT_VIEW.PAID_DAY_BEFORE_DUE' : 'PAYMENT_VIEW.PAID_DAYS_BEFORE_DUE';
			} else if (days > 0) {
				key = count === 1 ? 'PAYMENT_VIEW.PAID_DAY_AFTER_DUE' : 'PAYMENT_VIEW.PAID_DAYS_AFTER_DUE';
			}
			return { timing: this.getTranslation(key, { count }), late: days > 0, dateTitle };
		}
		const day = date.clone().startOf('day');
		const today = moment().locale(locale).startOf('day');
		const timing = day.isSame(today, 'day') ? this.getTranslation('PAYMENT_VIEW.TODAY') : day.from(today);
		return { timing, late: false, dateTitle };
	}

	/**
	 * The invoice's total, what is paid of it and what is still due. Paid adds up the invoice's payments once they are
	 * read (`count`); until then, or when they could not be read, it is what the invoice says is paid.
	 */
	private describeInvoice(count: number | null): void {
		const invoice = this.payment?.invoice;
		if (!invoice) {
			this.invoiceSummary = null;
			return;
		}
		const total = Number(invoice.totalValue) || 0;
		const paid =
			count !== null
				? this.invoicePayments.reduce((sum, row) => sum + (Number(row.payment.amount) || 0), 0)
				: Number(invoice.alreadyPaid) || 0;
		this.invoiceSummary = {
			invoice,
			total,
			paid,
			balance: Math.max(0, total - paid),
			paidInFull: total > 0 && paid >= total,
			percent: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0,
			count
		};
	}

	/** The payment as the delete confirmation names it, e.g. `Payment of $1,200.00 from Acme`. */
	private paymentName(payment: IPayment): string {
		const amount = formatExpenseMoney(
			Number(payment.amount) || 0,
			payment.currency,
			this.translateService.getCurrentLang() || undefined
		);
		const contact = paymentContactName(payment);
		return contact
			? this.getTranslation('PAYMENT_VIEW.DELETE_NAME_FROM', { amount, contact })
			: this.getTranslation('PAYMENT_VIEW.DELETE_NAME', { amount });
	}

	/**
	 * Where an action started: the payment the URL named, the organization selected and the page's load. An edit or a
	 * delete answers after its dialog and its save; by then the viewer may have followed a link to another payment or
	 * switched the organization, and the page they moved to must not be replaced or redirected by the older action.
	 */
	private actionOrigin(): ActionOrigin {
		return {
			paymentId: this.paymentId,
			organizationId: this.organization?.id,
			organization: this.organization,
			scope: this.viewScope,
			generation: this.loadSequence
		};
	}

	/** The page still shows the payment and the organization the action started on, from the same load. */
	private isStillOn(origin: ActionOrigin): boolean {
		return (
			this.paymentId === origin.paymentId &&
			this.organization?.id === origin.organizationId &&
			this.loadSequence === origin.generation
		);
	}

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the payment again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.viewScope;
		const sequence = ++this.loadSequence;
		try {
			const payment = await loadPayment(this.paymentService, id, scope);
			if (sequence !== this.loadSequence || this.paymentId !== id) return;
			if (payment) {
				this.show(payment);
				this.state = 'ready';
			} else {
				this.show(null);
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

	/** Notes a change of the payment in its invoice's history, as the payments list does. */
	private async createInvoiceHistory(action: string, invoice: IInvoice, origin: ActionOrigin): Promise<void> {
		const user = this.store.user;
		try {
			await this.invoiceEstimateHistoryService.add({
				action,
				invoice,
				invoiceId: invoice.id,
				user,
				userId: user?.id,
				organization: origin.organization,
				organizationId: origin.scope.organizationId,
				tenantId: origin.scope.tenantId
			});
		} catch (error) {
			// The payment itself is saved; a history line that could not be written does not undo it.
			console.error('Error creating invoice history:', error);
		}
	}
}
