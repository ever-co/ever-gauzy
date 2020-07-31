import { Component, Input } from '@angular/core';
import { ICandidateFeedback } from '@gauzy/models';

@Component({
	selector: 'ga-interview-interviewers',
	template: `
		<div class="employee" *ngIf="rowData.employees.length > 0">
			<span
				*ngFor="let employee of rowData.employees"
				nbTooltip=" {{ employee?.user?.name }}"
				nbTooltipPlacement="top"
			>
				<img
					class="image-employee"
					[src]="employee?.user?.imageUrl"
					alt="employee Avatar"
					[ngClass]="{
						active: isInterviewerActive(rowData.id, employee.id)
					}"
				/>
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
				&:hover {
					opacity: 1 !important;
				}
			}
			.active {
				opacity: 0.7 !important;
			}
		`
	]
})
export class InterviewersTableComponent {
	@Input()
	rowData: any;

	isInterviewerActive(interviewId: string, employeeId: string) {
		return this.rowData.allFeedbacks.find(
			(el: ICandidateFeedback) =>
				el.interviewId === interviewId &&
				el.interviewer &&
				employeeId === el.interviewer.employeeId
		);
	}
}
