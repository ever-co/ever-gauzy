import { OnInit, Component, Input, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import {
	IApprovalPolicy,
	IApprovalPolicyCreateInput,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { ApprovalPolicyService, Store } from '../../@core/services';
import { FormHelpers } from '../forms/helpers';
import { TranslationBaseComponent } from '../language-base';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-policy-mutation',
	templateUrl: './approval-policy-mutation.component.html',
  styleUrls:['./approval-policy-mutation.component.scss']
})
export class ApprovalPolicyMutationComponent
	extends TranslationBaseComponent
	implements OnInit {

	FormHelpers: typeof FormHelpers = FormHelpers;
	organization: IOrganization;

	@ViewChild('formDirective') formDirective: FormGroupDirective;
	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	private _approvalPolicy: IApprovalPolicy;
	get approvalPolicy(): IApprovalPolicy {
		return this._approvalPolicy;
	}
	@Input() set approvalPolicy(value: IApprovalPolicy) {
		this._approvalPolicy = value;
		this.patchForm();
	}

	/*
	* Approval Policy Mutation Form
	*/
	public form: FormGroup = ApprovalPolicyMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			description: [],
		});
	}

	constructor(
		private readonly dialogRef: NbDialogRef<ApprovalPolicyMutationComponent>,
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly fb: FormBuilder,
		public readonly translationService: TranslateService,
		private readonly store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async patchForm() {
		this.form.setValue({
			name: this.approvalPolicy ? this.approvalPolicy.name : '',
			description: this.approvalPolicy ? this.approvalPolicy.description : ''
		});
		this.form.updateValueAndValidity();
	}

	async closeDialog(approvalPolicy?: IApprovalPolicy) {
		this.onReset();
		this.dialogRef.close(approvalPolicy);
	}

	async onSubmit() {
		if (this.form.invalid || !this.formDirective.submitted) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const id = this.approvalPolicy ? this.approvalPolicy.id : null;

		const approvalPolicy: IApprovalPolicyCreateInput = {
			...this.form.getRawValue(),
			id,
			tenantId,
			organizationId
		};

		const result: IApprovalPolicy = await this.approvalPolicyService.save(approvalPolicy);
		this.closeDialog(result);
	}

	/**
	 * Reset approval policy mutation form after save
	 */
	onReset() {
		this.formDirective.reset();
	}
}
