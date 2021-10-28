import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-contact-links',
	template: `<ng-container *ngIf="rowData">
				<a
					*ngIf="rowData.name"
					(click)="navigateToContact()"
				>
					{{rowData.name}}
				</a>
			</ng-container>`
})
export class ContactLinksComponent implements ViewCell {
	@Input()
	rowData: any;
	@Input()
	value: any;

	constructor(private readonly router: Router) { }


	navigateToContact() {
		this.router.navigate([`/pages/contacts/clients/${this.rowData.id}`]);
	}
}
