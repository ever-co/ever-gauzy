import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-employee-links',
	template: `
		<ng-container *ngIf="value">
			<a
				*ngIf="value?.name"
				(click)="navigateToEmployee()"
				[ngClass]="{ 'link-text' : isNavigation }"
			>
				<img
					*ngIf="value.imageUrl"
					width="18px"
					height="18px"
					[src]="value.imageUrl"
				/>
				{{ value.name }}
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
	styleUrls: ['./employee-links.component.scss']
})
export class EmployeeLinksComponent {
	@Input()
	rowData: any;

	@Input()
	value: any;

	@Input() isNavigation: boolean = true;

	constructor(
		private readonly _router: Router
	) {}

	navigateToEmployee() {
		if (!this.value || !this.isNavigation) {
			return;
		}
		this._router.navigate([`/pages/employees/edit`, this.value.id]);
	}
}
