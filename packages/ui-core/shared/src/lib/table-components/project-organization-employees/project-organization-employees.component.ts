import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { IPersonListItem } from '../people-list/people-list.component';

/**
 * The members block of a project card (Organization → Projects, cards layout).
 *
 * Uses the same `ngx-people-list` treatment as the grid columns so the two
 * layouts of the same page render people identically; the card only lets the
 * group wrap and name more people, because it has the room.
 */
@Component({
	selector: 'gauzy-project-organization-employees',
	templateUrl: './project-organization-employees.component.html',
	styleUrls: ['./project-organization-employees.component.scss'],
	standalone: false
})
export class ProjectOrganizationEmployeesComponent {
	@Input() value: string | number;
	@Input() rowData: any;

	constructor(readonly router: Router) {}

	/**
	 * Navigates to the employee edit page of the clicked person.
	 *
	 * @param person - The person that was clicked in the list.
	 */
	edit(person: IPersonListItem): void {
		const id = person?.id;
		if (id) {
			this.router.navigate([`/pages/employees/edit/${id}`]);
		}
	}
}
