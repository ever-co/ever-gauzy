import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { BaseDashboardWidgetComponent } from '../../widget-host/base-dashboard-widget.component';

/**
 * One tile of the shortcuts grid.
 *
 * Built in TypeScript rather than repeated four times in the template, which is
 * what made the original component's two recurring-expense tiles drift into
 * carrying the very same label.
 */
interface IDataEntryShortcut {
	/** Stable key, used as the `@for` track. */
	id: string;
	/** Translation key of the tile heading. */
	titleKey: string;
	/** Translation key of the tile body. */
	descriptionKey: string;
	/** Eva icon name. */
	icon: string;
	/** Nebular status driving the tile's accent. */
	status: 'success' | 'danger';
	/** Route (with query string) opened when the tile is activated. */
	route: string;
}

/**
 * Quick links that jump straight into the "add income" / "add expense" flows.
 *
 * This wraps `ga-data-entry-shortcuts` as a widget — a component that was
 * written but never declared in ANY NgModule, so it could not be rendered at
 * all. Wrapping it fixes four things beyond making it reachable:
 *
 * 1. Its header was the untranslated literal "Data Entry Shortcuts". On a canvas
 *    the title belongs to `ga-dashboard-widget-host`, which translates it.
 * 2. Its two recurring-expense tiles shared one label
 *    (`DASHBOARD_PAGE.RECURRING_EXPENSES`), so they were indistinguishable; they
 *    now say Organization / Employee, and they open the recurring-expense pages
 *    with the create dialog rather than dropping the user on the generic
 *    organizations / employees list the original navigated to.
 * 3. The tiles were `<nb-card (click)>` — not focusable, not keyboard operable,
 *    and invisible to a screen reader. They are `<button>`s now.
 * 4. A user with none of the four permissions got an empty card; there is an
 *    explicit empty state.
 *
 * It fetches nothing, so it opts out of the base class' context-driven refresh.
 */
@Component({
	selector: 'ga-data-entry-shortcuts-widget',
	templateUrl: './data-entry-shortcuts-widget.component.html',
	styleUrls: ['./data-entry-shortcuts-widget.component.scss'],
	standalone: true,
	imports: [NbIconModule, TranslateModule],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataEntryShortcutsWidgetComponent extends BaseDashboardWidgetComponent {
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);

	/** Pure navigation: nothing to fetch, so the ambient context is irrelevant. */
	protected override readonly refreshOnContextChange = false;

	/** Bumped whenever role permissions change (sign-in, tenant switch, role edit). */
	private readonly permissionsVersion = signal(0);

	/** Tiles the current user is allowed to use. */
	protected readonly shortcuts = computed<IDataEntryShortcut[]>(() => {
		// Read so the list is re-evaluated when the permission set arrives.
		this.permissionsVersion();

		const shortcuts: IDataEntryShortcut[] = [];
		// Both halves are required on purpose: VIEW alone lets a user open the
		// page, but these tiles open the CREATE dialog straight away.
		const canAddIncome =
			this._store.hasPermission(PermissionsEnum.ORG_INCOMES_VIEW) &&
			this._store.hasPermission(PermissionsEnum.ORG_INCOMES_EDIT);
		const canAddExpense =
			this._store.hasPermission(PermissionsEnum.ORG_EXPENSES_VIEW) &&
			this._store.hasPermission(PermissionsEnum.ORG_EXPENSES_EDIT);
		// The EMPLOYEE recurring expenses page is gated by its OWN permission pair
		// in the sidebar (`employees-recurring-expenses`), not by the organization
		// expense one — offering the tile on `ORG_EXPENSES_*` would advertise a
		// page the route guard then refuses.
		const canAddEmployeeRecurringExpense =
			this._store.hasPermission(PermissionsEnum.EMPLOYEE_EXPENSES_VIEW) &&
			this._store.hasPermission(PermissionsEnum.EMPLOYEE_EXPENSES_EDIT);

		if (canAddIncome) {
			shortcuts.push({
				id: 'income',
				titleKey: 'MENU.INCOME',
				descriptionKey: 'DASHBOARD_PAGE.ADD_INCOME',
				icon: 'plus-circle-outline',
				status: 'success',
				route: 'pages/accounting/income?openAddDialog=true'
			});
		}

		if (canAddExpense) {
			shortcuts.push(
				{
					id: 'expense',
					titleKey: 'MENU.EXPENSES',
					descriptionKey: 'DASHBOARD_PAGE.ADD_EXPENSE',
					icon: 'minus-circle-outline',
					status: 'danger',
					route: 'pages/accounting/expenses?openAddDialog=true'
				},
				{
					id: 'organization-recurring-expense',
					titleKey: 'DASHBOARD_PAGE.BUILDER.WIDGETS.DATA_ENTRY_SHORTCUTS.ORGANIZATION_RECURRING',
					descriptionKey: 'DASHBOARD_PAGE.ADD_ORGANIZATION_RECURRING_EXPENSE',
					icon: 'minus-circle-outline',
					status: 'danger',
					// Same target the sidebar's "Expense Recurring" add-link uses. The
					// original component navigated to `pages/organizations`, i.e. the
					// org list — the advertised entry flow never opened.
					route: 'pages/accounting/expense-recurring?openAddDialog=true'
				}
			);
		}

		if (canAddEmployeeRecurringExpense) {
			shortcuts.push({
				id: 'employee-recurring-expense',
				titleKey: 'DASHBOARD_PAGE.BUILDER.WIDGETS.DATA_ENTRY_SHORTCUTS.EMPLOYEE_RECURRING',
				descriptionKey: 'DASHBOARD_PAGE.ADD_EMPLOYEE_RECURRING_EXPENSE',
				icon: 'minus-circle-outline',
				status: 'danger',
				// Same target the sidebar's "Recurring Expenses" add-link uses; the
				// original navigated to the employee LIST instead.
				route: 'pages/employees/recurring-expenses?openAddDialog=true'
			});
		}

		return shortcuts;
	});

	constructor() {
		super();

		// Permissions arrive asynchronously after sign-in and change on a tenant
		// switch; without this the widget would keep the very first evaluation.
		this._store.userRolePermissions$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.permissionsVersion.update((version: number) => version + 1));
	}

	/**
	 * Opens the page behind a shortcut.
	 *
	 * @param shortcut - The activated tile.
	 */
	public open(shortcut: IDataEntryShortcut): void {
		// Failures are swallowed on purpose: a rejected navigation (a guard said
		// no) is not a data error, and turning it into the widget's error state
		// would hide every other shortcut behind a retry button. `false` rather
		// than `undefined` so the handler matches `navigateByUrl`'s own
		// `Promise<boolean>` instead of widening it to `any`.
		void this._router.navigateByUrl(shortcut.route).catch(() => false);
	}
}
