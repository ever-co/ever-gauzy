import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-employee-links',
	template: `
		<ng-container *ngIf="value">
			<a *ngIf="value?.name" (click)="navigateToEmployee()" class="link-text">
				{{ value.name }}
			</a>
		</ng-container>
	`,
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
export class EmployeeLinksComponent {
	@Input()
	rowData: any;

	@Input()
	value: any;

	constructor(
		private readonly _router: Router
	) { }

	navigateToEmployee() {
		if (!this.value) {
			return;
		}
		
		this._router.navigate([
			'/pages/employees/edit/' + this.value.id
		]);
	}
}
