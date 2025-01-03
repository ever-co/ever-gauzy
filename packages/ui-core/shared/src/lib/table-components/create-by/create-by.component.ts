import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'ngx-create-by',
    templateUrl: './create-by.component.html',
    styleUrls: ['./create-by.component.scss'],
    standalone: false
})
export class CreateByComponent {
	@Input() value: any;
	@Input() rowData: any;

	constructor(
		private readonly router: Router
	) { }

	/**
	 *
	 * @param id
	 * @returns
	 */
	edit(id: string): void {
		if (!id) {
			// Handle the case where id is not provided
			console.error('Invalid employee id. Cannot proceed with editing.');
			// You might want to show a user-friendly message or redirect to an error page
			return;
		}

		// Navigate to the employee edit page with the provided id
		this.router.navigate(['/pages/employees/edit/' + id]);
	}
}
