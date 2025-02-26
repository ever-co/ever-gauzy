import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'ngx-employee-links',
    template: `
		<ng-container *ngIf="value">
			<a
				*ngIf="value?.name"
				(click)="navigateToEmployee()"
				[ngClass]="{ 'link-text': isNavigation }"
			>
				<img
					*ngIf="value.imageUrl"
					width="18px"
					height="18px"
					[src]="value.imageUrl"
				/>
				<div class="names-wrapper">
					{{ value.name }}
				</div>
			</a>
		</ng-container>
	`,
    styles: [
        `
			.link-text {
				cursor: pointer;
				text-decoration: none;
			}
			.link-text:hover {
				text-decoration: underline;
			}
		`
    ],
    styleUrls: ['./employee-links.component.scss'],
    standalone: false
})
export class EmployeeLinksComponent {

	@Input() rowData: any;
	@Input() value: any;
	@Input() isNavigation: boolean = true;

	constructor(
		private readonly _router: Router
	) { }

	/**
	 * Navigates to the employee edit page if the necessary conditions are met.
	 */
	navigateToEmployee(): void {
		// Check if either 'value' or 'isNavigation' is falsy
		if (!this.value || !this.isNavigation) {
			// If any condition is not met, return without navigating
			return;
		}

		// Navigate to the employee edit page with the ID from 'this.value.id'
		this._router.navigate([`/pages/employees/edit`, this.value.id]);
	}
}
