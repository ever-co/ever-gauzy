import { Component, Input, OnInit } from '@angular/core';
import { IEmployee, IUser } from '@gauzy/contracts';
import { Cell, DefaultEditor } from 'angular2-smart-table';

@Component({
    template: `
		<ng-container *ngIf="value">
			<a *ngIf="value?.name">
				<img *ngIf="value.imageUrl" width="18px" height="18px" [src]="value.imageUrl" />
				<div class="names-wrapper">
					{{ value.name }}
				</div>
			</a>
		</ng-container>
	`,
    styleUrls: ['../employee-links/employee-links.component.scss'],
    standalone: false
})
export class EmployeeLinkEditorComponent extends DefaultEditor implements OnInit {
	@Input() cell!: Cell; // Input to access the cell data
	value!: IUser;

	ngOnInit() {
		const employee: IEmployee | undefined = this.cell.getRow().getData();
		this.value = employee?.user ?? null;
	}
}
