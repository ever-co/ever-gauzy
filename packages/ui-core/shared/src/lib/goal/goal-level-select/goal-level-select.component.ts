import { Component, Input } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { GoalLevelEnum, IOrganizationTeam, IEmployee } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { OrganizationTeamsService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-goal-level-select',
    templateUrl: './goal-level-select.component.html',
    styleUrls: ['./goal-level-select.component.scss'],
    standalone: false
})
export class GoalLevelSelectComponent {
	@Input() parentFormGroup: UntypedFormGroup;
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

	constructor(private readonly organizationTeamsService: OrganizationTeamsService, private readonly store: Store) {}

	async getTeams() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;
		this.teams = (
			await this.organizationTeamsService.getAll(['members'], {
				organizationId,
				tenantId
			})
		).items;
	}

	selectEmployee(event, control) {
		if (this.alignedGoal) {
			this.parentFormGroup.patchValue({ alignedGoalOwner: event });
		} else {
			if (control === 'lead' && event !== '') {
				this.parentFormGroup.patchValue({ leadId: event });
			} else {
				this.parentFormGroup.patchValue({ ownerId: event });
			}
		}
	}

	onLevelChange(selectedLevel: GoalLevelEnum) {
		this.parentFormGroup.patchValue({ level: selectedLevel });

		if (selectedLevel === this.goalLevelEnum.TEAM) {
			this.getTeams();
		}
	}

	isLevelHidden(level: GoalLevelEnum): boolean {
		return (
			(this.hideOrg && level === this.goalLevelEnum.ORGANIZATION) ||
			(this.hideEmployee && level === this.goalLevelEnum.EMPLOYEE) ||
			(this.hideTeam && level === this.goalLevelEnum.TEAM)
		);
	}
}
