import { OnInit, Component, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	RequestApproval,
	Employee,
	OrganizationTeam,
	ApprovalPolicy
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { EmployeesService } from '../../@core/services/employees.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationTeamsService } from '../../@core/services/organization-teams.service';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';

@Component({
	selector: 'ngx-approval-mutation',
	templateUrl: './approvals-mutation.component.html'
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
	private _ngDestroy$ = new Subject<void>();

	constructor(
		public dialogRef: NbDialogRef<RequestApprovalMutationComponent>,
		private requestApprovalService: RequestApprovalService,
		private approvalPolicyService: ApprovalPolicyService,
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
			await this.approvalPolicyService.getAll([], {
				organizationId: this.organizationId
			})
		).items.filter((policy) => {
			return (
				policy.organizationId === this.organizationId ||
				this.organizationId === ''
			);
		});
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
			type: [
				this.requestApproval && this.requestApproval.type
					? this.requestApproval.type
					: ''
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
			]
		});
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
			requestApproval.type = 1;
			this.approvalPolicies.forEach((e) => {
				if (e.id === requestApproval.approvalPolicyId) {
					requestApproval.type = e.type;
				}
			});
		}
		this.dialogRef.close(requestApproval);
	}

	async saveRequestApproval() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		this.closeDialog(this.form.value);
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
