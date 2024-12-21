import { Component, Input } from '@angular/core';

@Component({
    templateUrl: './organizations-status.component.html',
    styleUrls: ['./organizations-status.component.scss'],
    standalone: false
})
export class OrganizationsStatusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
