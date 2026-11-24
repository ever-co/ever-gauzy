import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import * as moment from 'moment';
import {
	ComponentType,
	IOrganization,
	IOrganizationRecurringExpense,
	PermissionsEnum,
	RecurringExpenseDeletionEnum
} from '@gauzy/contracts';
import { ErrorHandlingService, OrganizationRecurringExpenseService, Store, ToastrService, monthNames } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DeleteConfirmationComponent,
	IRecordViewScope,
	IRecordViewSection,
	RecordViewPageState,
	RecurringExpenseDeleteConfirmationComponent,
	RecurringExpenseMutationComponent,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import {
	ORGANIZATION_RECURRING_EXPENSES_LIST_LINK,
	RecurringExpenseState,
	buildOrganizationRecurringExpenseViewSections,
	loadOrganizationRecurringExpense,
	loadOrganizationRecurringExpensePeriods,
	recurringExpenseCategoryName,
	recurringExpenseMonthsCharged,
	recurringExpenseStateOf
} from '../recurring-expense-record-view';

/** The tone each state is drawn in, as the project and expense pages colour their status. */
const STATE_TONE: Record<RecurringExpenseState, string> = {
	active: 'success',
	upcoming: 'info',
	ended: 'basic'
};

/** The recurring expense's headline, worked out once per load. */
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

/**
 * An organization recurring expense on its own full-width page, `/pages/accounting/expense-recurring/view/:id`:
 * where the recurring expenses drawer's "expand to full width" icon leads.
 *
 * Laid out as the expense page: the actions — Edit, Copy link and Delete — beside the back button; the headline —
 * the category, where it stands and how often it repeats, then the monthly amount, the start, the end and what it
 * has cost so far as figures; the history of its amount in the wide column; and the details and stamps in the side
 * column.
 *
 * The page belongs to the organization selected in the header: a recurring expense of another organization reads
 * "not found", and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-view-page',
	templateUrl: './recurring-expense-view-page.component.html',
	styleUrls: [
		'../../employees/view-employee/view-employee.component.scss',
		'../../projects/components/project-quick-look/project-quick-look.component.scss',
		'./recurring-expense-view-page.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false,
	// The project page's page layout: headline, then two columns.
	host: { class: 'is-page' }
})
export class RecurringExpenseViewPageComponent extends TranslationBaseComponent implements OnInit {
	readonly PermissionsEnum = PermissionsEnum;
	readonly backLink = ORGANIZATION_RECURRING_EXPENSES_LIST_LINK;

	/** The recurring expense as read: what the edit dialog is opened on. */
	expense: IOrganizationRecurringExpense = null;
	headline: IRecurringExpenseHeadline = null;
	/** The amount's periods, oldest first, this one among them. */
	periods: IRecurringExpensePeriod[] = [];
	periodsLoading = false;
	periodsFailed = false;

	/** Every field of the expense, at the top of the side column. */
	detailsSections: IRecordViewSection[] = [];
	/** The created / updated stamps, at the foot of the side column. */
	metaSections: IRecordViewSection[] = [];

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit or a delete is being saved: the actions wait for it. */
	busy = false;

	private expenseId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;
	/** The same for the history's read, which answers after the expense's. */
	private periodsSequence = 0;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService,
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
		// The category, the state and "a month ago" are worked out in the viewer's language.
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.describe();
			this.cdr.markForCheck();
		});
	}

	/** Loads (or reloads, after an error) the recurring expense the URL names. */
	async load(): Promise<void> {
		const id = this.expenseId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		this.periodsSequence++;
		// Nothing of the previous expense stays on screen while this one loads or if it fails.
		this.expense = null;
		this.headline = null;
		this.periods = [];
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const expense = await loadOrganizationRecurringExpense(this.organizationRecurringExpenseService, id, scope);
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

	/**
	 * Opens the form the list edits with and saves what it answers. An edit that starts the new amount in a later
	 * month ends this period and answers the new one: the page moves to it.
	 */
	async edit(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const dialog = this.dialogService.open(RecurringExpenseMutationComponent, {
			context: { recurringExpense: expense, componentType: ComponentType.ORGANIZATION }
		});
		const edited = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!edited || this.expense?.id !== expense.id) return;
		this.setBusy(true);
		try {
			const saved = await this.organizationRecurringExpenseService.update(expense.id, edited);
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.UPDATE_RECURRING_EXPENSE', {
				name: this.organization?.name
			});
			if (saved?.id && saved.id !== expense.id) {
				await this.router.navigate([ORGANIZATION_RECURRING_EXPENSES_LIST_LINK, 'view', saved.id]);
			} else {
				await this.refresh(expense.id);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/**
	 * Asks which months to delete — this month only, this month on, or all — as the list does, then asks once more
	 * before deleting. "This month" is today's month, kept within the expense's own months. When nothing of this
	 * period is left, the page goes back to the list.
	 */
	async delete(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const month = this.deletionMonth(expense);
		// The expense's name as the page shows it: typed back in the dialog before Ok is enabled, and named again
		// in the last confirmation.
		const name = this.headline?.title || recurringExpenseCategoryName(expense.categoryName, (key) => this.getTranslation(key));
		const result: RecurringExpenseDeletionEnum = await firstValueFrom(
			this.dialogService
				.open(RecurringExpenseDeleteConfirmationComponent, {
					context: {
						confirmName: name,
						recordType: 'Organization recurring expense',
						start: `${monthNames[expense.startMonth]}, ${expense.startYear}`,
						current: `${monthNames[month.month()]}, ${month.year()}`,
						end:
							expense.endMonth !== null && expense.endMonth !== undefined && expense.endYear
								? `${monthNames[expense.endMonth]}, ${expense.endYear}`
								: 'end'
					}
				})
				.onClose.pipe(first())
		);
		if (!result) return;
		// A second, plain "are you sure" before anything is deleted: the months dialog only picks what to delete. It
		// names the expense, so the viewer sees which one goes, e.g. `Organization Recurring Expense "Salary"`.
		const confirmed = await firstValueFrom(
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: { recordType: `${this.getTranslation('ORGANIZATIONS_PAGE.RECURRING_EXPENSE')} "${name}"` }
				})
				.onClose.pipe(first())
		);
		if (!confirmed || this.expense?.id !== expense.id) return;
		this.setBusy(true);
		try {
			await this.organizationRecurringExpenseService.delete(expense.id, {
				deletionType: result,
				month: month.month(),
				year: month.year()
			});
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.DELETE_RECURRING_EXPENSE', {
				name: this.organization?.name
			});
			const left =
				result === RecurringExpenseDeletionEnum.ALL
					? null
					: await loadOrganizationRecurringExpense(this.organizationRecurringExpenseService, expense.id, this.scope());
			if (left) {
				this.show(left);
			} else {
				await this.router.navigateByUrl(ORGANIZATION_RECURRING_EXPENSES_LIST_LINK);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.setBusy(false);
		}
	}

	/** Copies the page's address, to paste in a chat or a ticket. */
	async copyLink(): Promise<void> {
		if (!this.expense) return;
		const path = this.router.serializeUrl(
			this.router.createUrlTree([ORGANIZATION_RECURRING_EXPENSES_LIST_LINK, 'view', this.expense.id])
		);
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

	/** The link of a period of the history: its own page. */
	periodLink(period: IRecurringExpensePeriod): string[] {
		return [ORGANIZATION_RECURRING_EXPENSES_LIST_LINK, 'view', period.expense.id];
	}

	/* ── Reading and describing ── */

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the expense again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.scope();
		const sequence = ++this.loadSequence;
		try {
			const expense = await loadOrganizationRecurringExpense(this.organizationRecurringExpenseService, id, scope);
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
		} finally {
			this.cdr.markForCheck();
		}
	}

	private show(expense: IOrganizationRecurringExpense): void {
		this.expense = expense;
		this.describe();
		void this.loadPeriods(expense);
	}

	/** Reads the other periods of the same recurring expense. A failed read leaves the rest of the page as it is. */
	private async loadPeriods(expense: IOrganizationRecurringExpense): Promise<void> {
		const scope = this.scope();
		if (!scope) return;
		const sequence = ++this.periodsSequence;
		this.periodsLoading = true;
		this.periodsFailed = false;
		this.periods = [{ expense, isCurrent: true }];
		try {
			const periods = await loadOrganizationRecurringExpensePeriods(this.organizationRecurringExpenseService, expense, scope);
			if (sequence !== this.periodsSequence) return;
			const list = periods.some((period) => period.id === expense.id) ? periods : [...periods, expense];
			this.periods = list.map((period) => ({ expense: period, isCurrent: period.id === expense.id }));
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

	/** Works out the headline and the sections from the expense, in the viewer's language. */
	private describe(): void {
		const expense = this.expense;
		if (!expense) {
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

	/** Today's month, kept within the expense's months: the "this month" of the delete dialog. */
	private deletionMonth(expense: IOrganizationRecurringExpense): moment.Moment {
		const today = moment().startOf('month');
		const start = moment(expense.startDate).startOf('month');
		if (today.isBefore(start)) {
			return start;
		}
		if (expense.endDate) {
			const end = moment(expense.endDate).startOf('month');
			if (today.isAfter(end)) {
				return end;
			}
		}
		return today;
	}

	/** The organization the page reads in: the one selected in the header. */
	private scope(): IRecordViewScope | null {
		return this.organization ? { organizationId: this.organization.id, tenantId: this.organization.tenantId } : null;
	}
}
