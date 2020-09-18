import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { GoalLevelEnum, IOrganizationTeam, IEmployee } from '@gauzy/models';
import { OrganizationTeamsService } from '../../../@core/services/organization-teams.service';

@Component({
	selector: 'ga-goal-level-select',
	templateUrl: './goal-level-select.component.html',
	styleUrls: ['./goal-level-select.component.scss']
})
export class GoalLevelSelectComponent {
	@Input() parentFormGroup: FormGroup;
	@Input() orgId: string;
	@Input() teams: IOrganizationTeam[] = [];
	@Input() hideOrg = false;
	@Input() hideEmployee = false;
	@Input() hideTeam = false;
	@Input() helperText = '';
	@Input() employees: IEmployee[];
	@Input() orgName: string;
	@Input() enableHelperText = false;
	@Input() alignedGoal = false;

	goalLevelEnum = GoalLevelEnum;

	constructor(private organizationTeamsService: OrganizationTeamsService) {}

	async getTeams() {
		await this.organizationTeamsService
			.getAll(['members'], { organizationId: this.orgId })
			.then((res) => {
				const { items } = res;
				this.teams = items;
			});
	}

	selectEmployee(event, control) {
		if (this.alignedGoal) {
			this.parentFormGroup.patchValue({ alignedGoalOwner: event });
		} else {
			if (control === 'lead' && event !== '') {
				this.parentFormGroup.patchValue({ lead: event });
			} else {
				this.parentFormGroup.patchValue({ owner: event });
			}
		}
	}
}
