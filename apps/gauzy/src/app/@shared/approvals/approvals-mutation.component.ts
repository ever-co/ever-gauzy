import { OnInit, Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	RequestApproval,
	Employee,
	OrganizationTeam,
	ApprovalPolicy,
	RequestApprovalCreateInput,
	ApprovalPolicyTypesStringEnum,
	Tag
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { EmployeesService } from '../../@core/services/employees.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationTeamsService } from '../../@core/services/organization-teams.service';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { RequestApprovalService } from '../../@core/services/request-approval.service';

@Component({
	selector: 'ngx-approval-mutation',
	templateUrl: './approvals-mutation.component.html',
	styleUrls: ['./approvals-mutation.component.scss']
})
export class RequestApprovalMutationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	form: FormGroup;
	requestApproval: RequestApproval;
	organizationId: string;
	participants = 'employees';
	selectedMembers: string[];
	selectedTeams: string[];
	employees: Employee[] = [];
	approvalPolicies: ApprovalPolicy[] = [];
	teams: OrganizationTeam[];
	selectedEmployees: string[] = [];
	selectedApprovalPolicy: string[] = [];
	tags: Tag[] = [];

	private _ngDestroy$ = new Subject<void>();

	constructor(
		public dialogRef: NbDialogRef<RequestApprovalMutationComponent>,
		private approvalPolicyService: ApprovalPolicyService,
		private requestApprovalService: RequestApprovalService,
		private employeesService: EmployeesService,
		private organizationTeamsService: OrganizationTeamsService,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		readonly store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		if (this.requestApproval) {
			this.selectedTeams = this.requestApproval.teamApprovals.map(
				(team) => team.teamId
			);
			this.selectedEmployees = this.requestApproval.employeeApprovals.map(
				(emp) => emp.employeeId
			);
		}
		this.initializeForm();
		this.loadSelectedOrganization();
		this.loadEmployees();
		this.loadTeams();
		this.loadApprovalPolicies();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	async loadEmployees() {
		this.employeesService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items.filter((emp) => {
					return (
						emp.orgId === this.organizationId ||
						this.organizationId === ''
					);
				});
			});
	}

	async loadApprovalPolicies() {
		this.approvalPolicies = (
			await this.approvalPolicyService.getForRequestApproval([], {
				organizationId: this.organizationId
			})
		).items.filter((policy) => {
			return (
				policy.organizationId === this.organizationId ||
				this.organizationId === ''
			);
		});

		if (this.requestApproval) {
			if (this.requestApproval.approvalPolicy) {
				switch (this.requestApproval.approvalPolicy.approvalType) {
					case ApprovalPolicyTypesStringEnum.TIME_OFF:
					case ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING:
						this.approvalPolicies.push(
							this.requestApproval.approvalPolicy
						);
						break;
				}
			}
		}
	}

	loadSelectedOrganization() {
		this.organizationId = this.store.selectedOrganization
			? this.store.selectedOrganization.id
			: '';
	}

	onApprovalPolicySelected(approvalPolicySelection: string[]) {
		this.selectedApprovalPolicy = approvalPolicySelection;
	}

	async loadTeams() {
		this.teams = (
			await this.organizationTeamsService.getAll(['members'])
		).items.filter((org) => {
			return (
				org.organizationId === this.organizationId ||
				this.organizationId === ''
			);
		});
	}

	async initializeForm() {
		this.form = this.fb.group({
			name: [
				this.requestApproval && this.requestApproval.name
					? this.requestApproval.name
					: '',
				Validators.required
			],
			employees: [
				this.requestApproval &&
				this.requestApproval.employeeApprovals &&
				this.requestApproval.employeeApprovals.length > 0
					? this.requestApproval.employeeApprovals.map(
							(emp) => emp.id
					  )
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
				this.requestApproval && this.requestApproval.min_count
					? this.requestApproval.min_count
					: '',
				Validators.required
			],
			approvalPolicyId: [
				this.requestApproval && this.requestApproval.approvalPolicyId
					? this.requestApproval.approvalPolicyId
					: '',
				Validators.required
			],
			id: [
				this.requestApproval && this.requestApproval.id
					? this.requestApproval.id
					: null
			],
			tags:
				this.requestApproval && this.requestApproval.tags
					? [this.requestApproval.tags]
					: []
		});

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

	async closeDialog(requestApproval?: RequestApproval) {
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
		this.dialogRef.close(requestApproval);
	}

	async saveRequestApproval() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const requestApproval: RequestApprovalCreateInput = {
			name: this.form.value['name'],
			approvalPolicyId: this.form.value['approvalPolicyId'],
			min_count: this.form.value['min_count'],
			employeeApprovals: this.form.value['employees'],
			teams: this.form.value['teams'],
			id: this.form.value['id'],
			tags: this.form.get('tags').value
		};

		let result: RequestApproval;
		result = await this.requestApprovalService.save(requestApproval);
		this.closeDialog(result);
	}

	selectedTagsEvent(currentTagSelection: Tag[]) {
		this.form.get('tags').setValue(currentTagSelection);
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
	}
}
