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
				this.requestApproval ? this.requestApproval.name : '',
				Validators.required
			],
			employees: [
				this.requestApproval
					? this.requestApproval.employees.map((emp) => emp.id)
					: []
			],
			teams: [
				this.requestApproval
					? this.requestApproval.teams.map((team) => team.id)
					: []
			],
			type: [this.requestApproval ? this.requestApproval.type : ''],
			min_count: [
				this.requestApproval ? this.requestApproval.min_count : ''
			],
			approvalPolicyId: [
				this.requestApproval
					? this.requestApproval.approvalPolicyId
					: ''
			],
			id: [this.requestApproval ? this.requestApproval.id : null]
		});
	}

	async closeDialog(requestApproval?: RequestApproval) {
		this.dialogRef.close(requestApproval);
	}

	async saveRequestApproval() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		this.closeDialog();
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
