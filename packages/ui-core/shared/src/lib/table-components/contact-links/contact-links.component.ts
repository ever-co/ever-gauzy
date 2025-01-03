import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'ngx-contact-links',
    template: `
		<div class="contact-links-container">
			<ng-container *ngIf="value && value?.name">
				<div [nbTooltip]="value.name" (click)="navigateToContact()" class="inner-wrapper">
					<div *ngIf="!value.imageUrl" class="prefix">
						{{ value.name.substr(0, 1).toUpperCase() }}
					</div>
					<div *ngIf="value.imageUrl" class="avatar">
						<img [src]="value?.imageUrl" />
					</div>
					<div class="names-wrapper">
						<a class="link-text">{{ value.name }}</a>
					</div>
				</div>
			</ng-container>
		</div>
	`,
    styleUrls: ['./contact-links.component.scss'],
    standalone: false
})
export class ContactLinksComponent {
	@Input() rowData: any;
	@Input() value: any;

	constructor(private readonly _router: Router) {}

	/**
	 * Navigates to the contact view page for the current value.
	 *
	 * @return {void} This function does not return anything.
	 */
	navigateToContact(): void {
		if (!this.value) {
			return;
		}
		this._router.navigate([`/pages/contacts/view`, this.value.id]);
	}
}
