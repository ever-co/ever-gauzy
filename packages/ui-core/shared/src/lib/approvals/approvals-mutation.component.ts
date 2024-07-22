import { OnInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IRequestApproval,
	IEmployee,
	IOrganizationTeam,
	IApprovalPolicy,
	IRequestApprovalCreateInput,
	ApprovalPolicyTypesStringEnum,
	ITag
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

import { Store } from '@gauzy/ui-core/common';
import {
	ApprovalPolicyService,
	EmployeesService,
	OrganizationTeamsService,
	RequestApprovalService
} from '@gauzy/ui-core/core';
import { FormHelpers } from '../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-mutation',
	templateUrl: './approvals-mutation.component.html',
	styleUrls: ['./approvals-mutation.component.scss']
})
export class RequestApprovalMutationComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	form: UntypedFormGroup;
	requestApproval: IRequestApproval;
	organizationId: string;
	tenantId: string;
	participants = 'employees';
	selectedMembers: string[];
	selectedTeams: string[];
	employees: IEmployee[] = [];
	approvalPolicies: IApprovalPolicy[] = [];
	teams: IOrganizationTeam[];
	selectedEmployees: string[] = [];
	selectedApprovalPolicy: string[] = [];
	tags: ITag[] = [];

	constructor(
		public readonly dialogRef: NbDialogRef<RequestApprovalMutationComponent>,
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly requestApprovalService: RequestApprovalService,
		private readonly employeesService: EmployeesService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly fb: UntypedFormBuilder,
		public readonly translationService: TranslateService,
		public readonly store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		if (this.requestApproval) {
			this.selectedTeams = this.requestApproval.teamApprovals.map((team) => team.teamId);
			this.selectedEmployees = this.requestApproval.employeeApprovals.map((emp) => emp.employeeId);
		}
		this.initializeForm();
		this.loadSelectedOrganization();
		this.loadEmployees();
		this.loadTeams();
		this.loadApprovalPolicies();
	}

	ngOnDestroy() {}

	async loadEmployees() {
		this.employeesService
			.getAll(['user'], {
				organizationId: this.organizationId,
				tenantId: this.tenantId
			})
			.pipe(untilDestroyed(this))
			.subscribe((employees) => {
				const { items } = employees;
				this.employees = items;
			});
	}

	async loadApprovalPolicies() {
		this.approvalPolicies = (
			await this.approvalPolicyService.getForRequestApproval([], {
				organizationId: this.organizationId,
				tenantId: this.tenantId
			})
		).items;
		if (this.requestApproval) {
			if (this.requestApproval.approvalPolicy) {
				switch (this.requestApproval.approvalPolicy.approvalType) {
					case ApprovalPolicyTypesStringEnum.TIME_OFF:
					case ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING:
						this.approvalPolicies.push(this.requestApproval.approvalPolicy);
						break;
				}
			}
		}
		if (!this.requestApproval && this.approvalPolicies && this.approvalPolicies.length > 0) {
			this.approvalPolicies.filter((item) => {
				if (item.approvalType == 'DEFAULT_APPROVAL_POLICY') {
					this.form.patchValue({
						approvalPolicyId: item.id
					});
				}
			});
		}
	}

	loadSelectedOrganization() {
		const { id: organizationId = null, tenantId = null } = this.store.selectedOrganization;

		this.organizationId = organizationId;
		this.tenantId = tenantId;
	}

	onApprovalPolicySelected(approvalPolicySelection: string[]) {
		this.selectedApprovalPolicy = approvalPolicySelection;
	}

	async loadTeams() {
		this.teams = (
			await this.organizationTeamsService.getAll(['members'], {
				organizationId: this.organizationId,
				tenantId: this.tenantId
			})
		).items;
	}

	async initializeForm() {
		this.form = this.fb.group({
			name: [
				this.requestApproval && this.requestApproval.name ? this.requestApproval.name : '',
				Validators.required
			],
			employees: [
				this.requestApproval &&
				this.requestApproval.employeeApprovals &&
				this.requestApproval.employeeApprovals.length > 0
					? this.requestApproval.employeeApprovals.map((emp) => emp.id)
					: []
			],
			teams: [
				this.requestApproval &&
				this.requestApproval.teamApprovals &&
				this.requestApproval.teamApprovals.length > 0
					? this.requestApproval.teamApprovals.map((team) => team.id)
					: []
			],
			min_count: [
				this.requestApproval && this.requestApproval.min_count ? this.requestApproval.min_count : 1,
				Validators.required
			],
			approvalPolicyId: [
				this.requestApproval && this.requestApproval.approvalPolicyId
					? this.requestApproval.approvalPolicyId
					: '',
				Validators.required
			],
			id: [this.requestApproval && this.requestApproval.id ? this.requestApproval.id : null],
			tags: this.requestApproval && this.requestApproval.tags ? [this.requestApproval.tags] : []
		});
		this.participants =
			this.requestApproval && this.requestApproval.teamApprovals.length > 0 ? 'teams' : 'employees';
		this.tags = this.form.get('tags').value || [];

		if (this.requestApproval) {
			if (this.requestApproval.approvalPolicy) {
				switch (this.requestApproval.approvalPolicy.approvalType) {
					case ApprovalPolicyTypesStringEnum.TIME_OFF:
					case ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING:
						this.form.get('approvalPolicyId').disable();
						break;
				}
			}
		}
	}

	async closeDialog(requestApproval?: IRequestApproval) {
		const members: any[] = [];
		const listEmployees: any[] = [];
		if (requestApproval) {
			if (requestApproval.teams) {
				this.teams.forEach((i) => {
					requestApproval.teams.forEach((e: any) => {
						if (e === i.id) {
							i.members.forEach((id) => {
								members.push(id.employeeId);
							});
						}
					});
				});
			}
			if (requestApproval.employees) {
				requestApproval.employees.forEach((e) => {
					if (!members.includes(e)) {
						listEmployees.push(e);
					}
				});
			}
			requestApproval.employees = listEmployees;
		}
		this.onReset();
		this.dialogRef.close(requestApproval);
	}

	async onSubmit() {
		if (this.form.invalid || !this.formDirective.submitted) {
			return;
		}

		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const requestApproval: IRequestApprovalCreateInput = {
			name: this.form.value['name'],
			approvalPolicyId: this.form.value['approvalPolicyId'],
			min_count: this.form.value['min_count'],
			employeeApprovals: this.form.value['employees'],
			teams: this.form.value['teams'],
			id: this.form.value['id'],
			tags: this.form.get('tags').value,
			organizationId: this.organizationId,
			tenantId: this.tenantId
		};
		let result: IRequestApproval;
		result = await this.requestApprovalService.save(requestApproval);
		this.closeDialog(result);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.form.get('tags').setValue(currentTagSelection);
		this.form.get('tags').updateValueAndValidity();
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}

	onEmployeesSelected(employeeSelection: string[]) {
		this.selectedEmployees = employeeSelection;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}

	onParticipantsChange(participants: string) {
		this.participants = participants;
		if (participants === 'employees') {
			this.form.get('teams').setValue([]);
		} else {
			this.form.get('employees').setValue([]);
		}
		this.form.updateValueAndValidity();
	}

	/**
	 * Reset approval request mutation form after save
	 */
	onReset() {
		this.formDirective.reset();
	}
}
