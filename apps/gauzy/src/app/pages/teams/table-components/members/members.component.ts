import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-team-employees',
	template: `
		<div class="employee" *ngIf="rowData.members.length > 0">
			<span
				*ngFor="let employee of rowData.members"
				nbTooltip=" {{ employee?.user?.name }}"
				nbTooltipPlacement="top"
			>
				<img
					class="image-employee"
					[src]="employee?.user?.imageUrl"
					alt="employee Avatar"
				/>
			</span>
		</div>
	`,
	styles: [
		`
			.employee {
				display: flex;
				flex-direction: row;
				justify-content: flex-start;
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
export class TeamMembersTableComponent {
	@Input()
	rowData: any;
}
