import { Component, EventEmitter, Input, Output } from '@angular/core';
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
	/** The field under the pointer or holding focus (`'objective-level'`, `-owner`, `-lead`), `''` when none. */
	@Output() helperTextChange = new EventEmitter<string>();

	goalLevelEnum = GoalLevelEnum;

	/**
	 * The field the pointer is over and the field holding keyboard focus, tracked apart: held in one value,
	 * ending either interaction cleared the help while the other was still on the field.
	 */
	private hoveredField = '';
	private focusedField = '';

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

	/** Records the field the pointer moved onto, or `''` when it left one, then shows whichever help wins. */
	hoverHelper(field: string) {
		this.hoveredField = field;
		this.showHelper(this.currentField());
	}

	/** Records the field that took keyboard focus, or `''` when it lost it, then shows whichever help wins. */
	focusHelper(field: string) {
		this.focusedField = field;
		this.showHelper(this.currentField());
	}

	/**
	 * The field the help should be on. The pointer wins while it is over a field, so hovering one field while
	 * another holds focus still reads as it did; the help falls back to the focused field and only clears
	 * once both interactions have ended.
	 */
	private currentField(): string {
		return this.hoveredField || this.focusedField;
	}

	/**
	 * Shows the given field's help beside it when this component draws the help itself, and reports the
	 * field either way, for a dialog that draws the help in a column of its own.
	 */
	showHelper(field: string) {
		if (this.enableHelperText) {
			this.helperText = field;
		}
		this.helperTextChange.emit(field);
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
