import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-create-by',
	templateUrl: './create-by.component.html',
	styleUrls: ['./create-by.component.scss']
})
export class CreateByComponent implements ViewCell {
	@Input()
	value: any;
	@Input()
	rowData: any;

	constructor(private readonly router: Router) {}

	edit(id: string) {
		if (id) {
			this.router.navigate(['/pages/employees/edit/' + id]);
		}
	}
}
