import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ID } from '@gauzy/contracts';

@Component({
	selector: 'ngx-created-by-user',
	templateUrl: './created-by-user.component.html',
	styleUrls: ['./created-by-user.component.scss']
})
export class CreatedByUserComponent<Entity = any> {
	@Input() value: any;
	@Input() rowData: Entity;

	constructor(private readonly router: Router) {}

	/**
	 * Navigates to the employee edit page using the provided ID.
	 *
	 * @param id - The unique identifier of the employee to edit.
	 */
	edit(id: ID): void {
		if (!id) {
			console.error('Invalid employee id. Cannot proceed with editing.');
			return;
		}
		this.router.navigate([`/pages/employees/edit/${id}`]);
	}
}
