import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-contact-links',
	template: `
		<ng-container *ngIf="value">
			<a *ngIf="value?.name" (click)="navigateToContact()" class="link-text">
				<span>{{ value.name.substr(0,2).toUpperCase() }}</span>{{ value.name }}
			</a>
		</ng-container>
	`,
	styleUrls: ['./contact-links.component.scss']
})
export class ContactLinksComponent {
	@Input()
	rowData: any;

	@Input()
	value: any;

	constructor(
		private readonly _router: Router
	) {}

	navigateToContact() {
		if (!this.value) {
			return;
		}
		this._router.navigate([`/pages/contacts/view/${this.value.id}`, ]);
	}
}
