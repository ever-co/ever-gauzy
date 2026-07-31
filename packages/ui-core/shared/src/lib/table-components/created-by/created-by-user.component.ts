import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ID, IUser } from '@gauzy/contracts';

@Component({
	selector: 'ngx-created-by-user',
	templateUrl: './created-by-user.component.html',
	styleUrls: ['./created-by-user.component.scss'],
	standalone: false
})
export class CreatedByUserComponent<Entity = any> {
	@Input() value: any;
	@Input() rowData: Entity;

	constructor(private readonly router: Router) {}

	/**
	 * Resolves the *employee* id of the given user, if the user has an employee profile.
	 *
	 * `createdByUser.id` is a user id, while `/pages/employees/edit/:id` is keyed by employee id —
	 * navigating with the former resolves to nothing and silently bounces back to Manage Employees.
	 *
	 * @param user - The user who created the record.
	 * @returns The employee id, or `undefined` when the user has no employee profile.
	 */
	employeeId(user: IUser): ID | undefined {
		return user?.employee?.id ?? user?.employeeId;
	}

	/**
	 * Navigates to the employee edit page of the given user, when that user is an employee.
	 *
	 * @param user - The user who created the record.
	 */
	edit(user: IUser): void {
		const employeeId = this.employeeId(user);
		if (!employeeId) {
			// Not an employee (an admin, for example) — there is no employee page to open.
			return;
		}
		this.router.navigate([`/pages/employees/edit/${employeeId}`]);
	}
}
