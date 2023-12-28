import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-create-by',
	templateUrl: './create-by.component.html',
	styleUrls: ['./create-by.component.scss']
})
export class CreateByComponent {
	@Input() value: any;
	@Input() rowData: any;

	constructor(private readonly router: Router) { }

	edit(id: string) {
		if (id) {
			this.router.navigate(['/pages/employees/edit/' + id]);
		}
	}
}
