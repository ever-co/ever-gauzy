import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
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
	RecordViewPageState,
	RecurringExpenseDeleteConfirmationComponent,
	RecurringExpenseMutationComponent,
	recordViewPageStateOf
} from '@gauzy/ui-core/shared';
import {
	ORGANIZATION_RECURRING_EXPENSES_LIST_LINK,
	loadOrganizationRecurringExpense,
	recurringExpenseCategoryName,
	recurringExpenseFocusMonth
} from '../recurring-expense-record-view';

/** Where an edit or a delete started, so its answer can tell whether the page is still the one it changed. */
interface ActionOrigin {
	expenseId: string;
	organizationId: string;
	organizationName: string;
	scope: IRecordViewScope;
	/** The page's load when the action started. */
	generation: number;
}

/**
 * An organization recurring expense on its own full-width page, `/pages/accounting/expense-recurring/view/:id`:
 * where the recurring expenses drawer's "expand to full width" icon leads.
 *
 * Laid out as the expense page: the actions — Edit, Copy link and Delete — beside the back button, then the expense
 * as the list's drawer shows it (`ga-recurring-expense-quick-look`), given the whole width: the headline across the
 * top, its cost month by month and the history of its amount in the wide column, the details, its share of the
 * month's recurring costs and the stamps in the side column.
 *
 * The page belongs to the organization selected in the header: a recurring expense of another organization reads
 * "not found", and switching the organization reloads the page, discarding any load in flight.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-view-page',
	templateUrl: './recurring-expense-view-page.component.html',
	styleUrls: ['./recurring-expense-view-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class RecurringExpenseViewPageComponent extends TranslationBaseComponent implements OnInit {
	readonly PermissionsEnum = PermissionsEnum;
	readonly backLink = ORGANIZATION_RECURRING_EXPENSES_LIST_LINK;

	/** The recurring expense as read: what the edit dialog is opened on, and what the quick look shows. */
	expense: IOrganizationRecurringExpense = null;
	/** The organization the page reads in, as the quick look reads its history and its month. */
	viewScope: IRecordViewScope = null;

	state: RecordViewPageState = 'loading';
	organization: IOrganization | null = null;
	/** An edit or a delete is being saved: the actions wait for it. */
	busy = false;

	private expenseId: string = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;

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
				this.viewScope = { organizationId: organization.id, tenantId: organization.tenantId };
				void this.load();
			});
	}

	/** Loads (or reloads, after an error) the recurring expense the URL names. */
	async load(): Promise<void> {
		const id = this.expenseId;
		const scope = this.viewScope;
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous expense stays on screen while this one loads or if it fails.
		this.expense = null;
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
			this.expense = expense;
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
		const origin = this.actionOrigin();
		const dialog = this.dialogService.open(RecurringExpenseMutationComponent, {
			context: { recurringExpense: expense, componentType: ComponentType.ORGANIZATION }
		});
		const edited = await firstValueFrom(dialog.onClose.pipe(first()));
		if (!edited || !this.isStillOn(origin)) return;
		this.setBusy(true);
		try {
			const saved = await this.organizationRecurringExpenseService.update(expense.id, edited);
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.UPDATE_RECURRING_EXPENSE', {
				name: origin.organizationName
			});
			// The viewer moved to another expense or organization while it saved: the page is theirs now.
			if (!this.isStillOn(origin)) return;
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
	 * before deleting. "This month" is the focus month: today's, kept within the expense's own months. When nothing
	 * of this period is left, the page goes back to the list.
	 */
	async delete(): Promise<void> {
		const expense = this.expense;
		if (!expense || this.busy) return;
		const origin = this.actionOrigin();
		const month = recurringExpenseFocusMonth(expense);
		// The expense's name as the page shows it: typed back in the dialog before Ok is enabled, and named again
		// in the last confirmation.
		const name =
			recurringExpenseCategoryName(expense.categoryName, (key) => this.getTranslation(key)) ||
			this.getTranslation('ORGANIZATIONS_PAGE.RECURRING_EXPENSE');
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
								: this.getTranslation('RECURRING_EXPENSE_VIEW.NO_END_DATE')
					}
				})
				.onClose.pipe(first())
		);
		if (!result || !this.isStillOn(origin)) return;
		// A second, plain "are you sure" before anything is deleted: the months dialog only picks what to delete. It
		// names the expense, so the viewer sees which one goes, e.g. `Organization Recurring Expense "Salary"`.
		const confirmed = await firstValueFrom(
			this.dialogService
				.open(DeleteConfirmationComponent, {
					context: { recordType: `${this.getTranslation('ORGANIZATIONS_PAGE.RECURRING_EXPENSE')} "${name}"` }
				})
				.onClose.pipe(first())
		);
		if (!confirmed || !this.isStillOn(origin)) return;
		this.setBusy(true);
		try {
			await this.organizationRecurringExpenseService.delete(expense.id, {
				deletionType: result,
				month: month.month(),
				year: month.year()
			});
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_RECURRING_EXPENSES.DELETE_RECURRING_EXPENSE', {
				name: origin.organizationName
			});
			// The viewer moved to another expense or organization while it deleted: the page is theirs now.
			if (!this.isStillOn(origin)) return;
			const left =
				result === RecurringExpenseDeletionEnum.ALL
					? null
					: await loadOrganizationRecurringExpense(this.organizationRecurringExpenseService, expense.id, origin.scope);
			// No newer load started while it read: what is left of the expense is still this page's.
			if (!this.isStillOn(origin)) return;
			if (left) {
				this.expense = left;
				this.cdr.markForCheck();
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

	/* ── Reading ── */

	/**
	 * Where an action started: the expense the URL named, the organization selected and the page's load. An edit or
	 * a delete answers after its dialogs and its save; by then the viewer may have followed a history link or
	 * switched the organization, and the page they moved to must not be replaced or redirected by the older action.
	 */
	private actionOrigin(): ActionOrigin {
		return {
			expenseId: this.expenseId,
			organizationId: this.organization?.id,
			organizationName: this.organization?.name,
			scope: this.viewScope,
			generation: this.loadSequence
		};
	}

	/**
	 * The page still shows the expense and the organization the action started on, from the same load. Going to
	 * another expense and back starts a new load: its answer, not the older action's, then owns the page.
	 */
	private isStillOn(origin: ActionOrigin): boolean {
		return (
			this.expenseId === origin.expenseId &&
			this.organization?.id === origin.organizationId &&
			this.loadSequence === origin.generation
		);
	}

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.cdr.markForCheck();
	}

	/** Reads the expense again after a change made here, keeping the page on screen while it does. */
	private async refresh(id: string): Promise<void> {
		const scope = this.viewScope;
		const sequence = ++this.loadSequence;
		try {
			const expense = await loadOrganizationRecurringExpense(this.organizationRecurringExpenseService, id, scope);
			if (sequence !== this.loadSequence || this.expenseId !== id) return;
			if (expense) {
				this.expense = expense;
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
}
