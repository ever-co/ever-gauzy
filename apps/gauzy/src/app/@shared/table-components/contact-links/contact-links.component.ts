import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-contact-links',
	template: `<ng-container *ngIf="value">
		<a *ngIf="value?.name" (click)="navigateToContact()" class="link-text">
			{{ value.name }}
		</a>
	</ng-container>`,
	styles: [
		`
			.link-text {
				cursor: pointer;
				text-decoration: none;
				color: #1e6bb8;
			}
			.link-text:hover {
				text-decoration: underline;
			}
		`
	]
})
export class ContactLinksComponent {
	@Input()
	rowData: any;
	@Input()
	value: any;

	constructor(private readonly router: Router) { }

	navigateToContact() {
		this.router.navigate([`/pages/contacts/view/${this.value.id}`]);
		// if (this.value.contactType == ContactType.CLIENT) {
		// 	this.router.navigate([`/pages/contacts/view/${this.value.id}`], {
		// 		queryParams: { id: this.value.id }
		// 	});
		// }

		// if (this.value.contactType == ContactType.CUSTOMER) {
		// 	this.router.navigate([`/pages/contacts/customers`], {
		// 		queryParams: { id: this.value.id }
		// 	});
		// }

		// if (this.value.contactType == ContactType.LEAD) {
		// 	this.router.navigate([`/pages/contacts/leads`], {
		// 		queryParams: { id: this.value.id }
		// 	});
		// }
	}
}
