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
