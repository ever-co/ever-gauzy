import { Component, OnDestroy, OnInit } from '@angular/core';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseEntityEnum, IEmployee } from '@gauzy/contracts';
import { EmployeeStore } from '@gauzy/ui-core/core';

/**
 * "Documents" tab of the employee edit page — the record-side Documents panel
 * (`00-product-spec.md` §6.14 R-LNK-02) for one employee.
 *
 * The employee tabset is **route**-based (`tabsetType: 'route'` in
 * `edit-employee-profile.component.ts`), so a tab needs a routed component; this is
 * that shell and nothing more. The panel itself is standalone, self-gating on
 * `DOCS_READ` + `FEATURE_DOCUMENTS`, and owns every request.
 *
 * The employee comes from `EmployeeStore` — the same source every sibling tab uses
 * — rather than from the route params, so it stays in step when the profile page
 * reloads the record.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-documents',
	templateUrl: './edit-employee-documents.component.html',
	/*
	 * This tab carried no styles at all, so it was the one tab with no surface of
	 * its own: the panel floated on bare card body, and on a deployment with the
	 * Documents feature off the tab rendered nothing and the card body showed
	 * through for its whole height. The fill and the flex column are the same two
	 * the sibling tabs use — the tabset hands each tab the height the card body
	 * has left over (edit-employee-profile.component.scss), and the panel grows
	 * into it. `flex-shrink: 0` because the host scrolls: a long list of links
	 * keeps its height and scrolls inside the host.
	 *
	 * `gz-document-links-panel` is shared with the invoice and estimate pages, so
	 * it is sized from here rather than in its own stylesheet.
	 */
	styles: [
		`
			:host {
				background-color: var(--gauzy-card-2);
				padding: 1rem;
				display: flex;
				flex-direction: column;
				overflow-y: auto;
			}

			:host > gz-document-links-panel {
				display: flex;
				flex-direction: column;
				flex: 1 0 auto;
			}

			:host ::ng-deep gz-document-links-panel > .docs-links-panel {
				flex: 1 0 auto;
			}
		`
	],
	standalone: false
})
export class EditEmployeeDocumentsComponent implements OnInit, OnDestroy {
	public selectedEmployee: IEmployee;

	/** Entity type the links are attached to. */
	public readonly documentEntity = BaseEntityEnum.Employee;

	constructor(private readonly employeeStore: EmployeeStore) {}

	ngOnInit(): void {
		this.employeeStore.selectedEmployee$
			.pipe(
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => (this.selectedEmployee = employee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Link label captured at attach time, so the hub can name the employee. */
	get employeeName(): string {
		const employee = this.selectedEmployee;
		if (!employee) return '';
		return (
			employee.fullName ||
			employee.user?.name ||
			[employee.user?.firstName, employee.user?.lastName].filter(Boolean).join(' ') ||
			String(employee.id)
		);
	}

	ngOnDestroy(): void {}
}
