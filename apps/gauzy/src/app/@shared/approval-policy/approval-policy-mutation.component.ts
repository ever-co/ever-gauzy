import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	IApprovalPolicy,
	IEmployee,
	IApprovalPolicyCreateInput,
	ApprovalPolicyTypesEnum,
	IOrganization
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';

export interface SelectedApprovalPolicy {
	name: string;
	value: ApprovalPolicyTypesEnum;
}

@Component({
	selector: 'ngx-approval-policy-mutation',
	templateUrl: './approval-policy-mutation.component.html'
})
export class ApprovalPolicyMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	approvalPolicy: IApprovalPolicy;
	employees: IEmployee[] = [];
	organizationId: string;
	// TODO: remove from here, we should never use TenantId in the client app
	tenantId: string;
	isHasType = true;
	organization: IOrganization;

	constructor(
		public dialogRef: NbDialogRef<ApprovalPolicyMutationComponent>,
		private approvalPolicyService: ApprovalPolicyService,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		readonly store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.initializeForm();
	}

	async initializeForm() {
		this.form = this.fb.group({
			name: [
				this.approvalPolicy ? this.approvalPolicy.name : '',
				Validators.required
			],
			description: [
				this.approvalPolicy ? this.approvalPolicy.description : ''
			],
			organizationId: [
				this.approvalPolicy ? this.approvalPolicy.organizationId : ''
			],
			id: [this.approvalPolicy ? this.approvalPolicy.id : null]
		});
	}

	async closeDialog(approvalPolicy?: IApprovalPolicy) {
		this.dialogRef.close(approvalPolicy);
	}

	async saveApprovalPolicy() {
		const approvalPolicy: IApprovalPolicyCreateInput = {
			name: this.form.value['name'],
			description: this.form.value['description'],
			organizationId: this.organizationId,
			tenantId: this.tenantId,
			id: this.form.value['id']
		};

		let result: IApprovalPolicy;
		result = await this.approvalPolicyService.save(approvalPolicy);

		this.closeDialog(result);
	}
}
