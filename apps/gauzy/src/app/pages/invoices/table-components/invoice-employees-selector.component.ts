import { Component, OnInit } from '@angular/core';
import { Employee } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'INVOICES_PAGE.SELECT_EMPLOYEE' | translate }}"
			[(ngModel)]="employee"
			(selectedChange)="selectEmployee($event)"
		>
			<nb-option *ngFor="let employee of employees" [value]="employee">
				<img
					src="{{ employee.user.imageUrl }}"
					alt="Smiley face"
					height="40"
					width="40"
					style="margin-right:10px"
				/>
				{{ employee.user.firstName }}
				{{ employee.user.lastName }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceEmployeesSelectorComponent extends TranslationBaseComponent
	implements OnInit {
	rowData: any;
	employee: Employee;
	employees: Employee[];

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.getEmployees();
	}

	async getEmployees() {
		this.employees = this.rowData.allEmployees;
		if (this.employees) {
			const employee = this.employees.filter(
				(e) => e.id === this.rowData.selectedEmployee
			);
			this.employee = employee[0];
		}
	}

	selectEmployee($event) {
		this.rowData.selectedEmployee = $event.id;
	}
}
