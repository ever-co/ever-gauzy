import { Component, Input, OnInit } from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { first } from 'rxjs/operators';
import { CandidateFeedbacksService } from 'apps/gauzy/src/app/@core/services/candidate-feedbacks.service';
import {
	ICandidateFeedback,
	ICandidateInterviewers,
	Employee
} from '@gauzy/models';

@Component({
	selector: 'ga-interview-interviewers',
	template: `
		<div
			*ngFor="let employee of this.rowData.employees"
			nbTooltip=" {{ employee?.user?.name }}"
			nbTooltipPlacement="top"
		>
			<img
				class="image-employee"
				[src]="employee?.user?.imageUrl"
				alt="employee Avatar"
			/>
		</div>
	`,
	styles: [
		`
			.image-employee {
				max-width: 30px;
				max-height: 30px;
				border-radius: 50%;
				margin-left: 0.5rem;
				&:hover {
					opacity: 1 !important;
				}
			}
			.active {
				opacity: 0.6 !important;
			}
		`
	]
})
export class InterviewersTableComponent implements OnInit {
	@Input()
	rowData: any;
	employees: Employee[] = [];
	feedbacks: ICandidateFeedback[];
	constructor(
		private employeesService: EmployeesService,
		private candidateFeedbacksService: CandidateFeedbacksService
	) {}
	async ngOnInit() {
		const result = await this.candidateFeedbacksService.getAll([
			'interviewer'
		]);
		this.feedbacks = result ? result.items : [];

		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		this.rowData.interviewers.forEach(
			(interviewer: ICandidateInterviewers) => {
				items.forEach((employee: Employee) => {
					if (interviewer.employeeId === employee.id) {
						this.employees.push(employee);
					}
				});
			}
		);
		this.rowData.employees = this.employees;
	}
	isInterviewerActive(interviewId: string, employeeId: string) {
		// return this.feedbacks.find(
		// 	(el: ICandidateFeedback) =>
		// 		el.interviewId === interviewId &&
		// 		el.interviewer &&
		// 		employeeId === el.interviewer.employeeId
		// );
	}
}
