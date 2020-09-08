import { Component, Input } from '@angular/core';
import {
	SelectedEmployee,
	ALL_EMPLOYEES_SELECTED
} from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Router } from '@angular/router';

@Component({
	selector: 'ga-interview-interviewers',
	template: `
		<div class="employee" *ngIf="rowData.employees?.length > 0">
			<span
				*ngFor="let employee of rowData.employees"
				nbTooltip=" {{ employee?.user?.name }}"
				nbTooltipPlacement="top"
			>
				<a
					*ngIf="employee.user"
					(click)="
						selectEmployee(
							employee,
							employee.user.firstName,
							employee.user.lastName,
							employee.user.imageUrl
						)
					"
				>
					<img
						class="image-employee"
						[src]="employee?.user?.imageUrl"
						alt="employee Avatar"
					/>
				</a>
			</span>
		</div>
	`,
	styles: [
		`
			.employee {
				display: flex;
				flex-direction: row;
				justify-content: center;
				align-items: center;
				flex-wrap: wrap;
			}
			.image-employee {
				max-width: 30px;
				max-height: 30px;
				border-radius: 50%;
				margin: 0.25rem;
			}
		`
	]
})
export class InterviewersTableComponent {
	@Input()
	rowData: any;
	constructor(private store: Store, private readonly router: Router) {}
	selectEmployee(
		employee: SelectedEmployee,
		firstName: string,
		lastName: string,
		imageUrl: string
	) {
		this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		this.store.selectedEmployee.firstName = firstName;
		this.store.selectedEmployee.lastName = lastName;
		this.store.selectedEmployee.imageUrl = imageUrl;
		if (employee) {
			this.navigateToEmployeeStatistics(employee.id);
		}
	}

	navigateToEmployeeStatistics(id: string) {
		this.router.navigate([`/pages/employees/edit/${id}/account`]);
	}
}
