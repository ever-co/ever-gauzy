import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './organizations-status.component.html',
	styleUrls: ['./organizations-status.component.scss']
})
export class OrganizationsStatusComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
