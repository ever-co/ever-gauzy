import { OnInit, Component, Input, ViewChild } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { IApprovalPolicy, IApprovalPolicyCreateInput, IOrganization } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { ApprovalPolicyService, Store, ToastrService } from '../../@core/services';
import { FormHelpers } from '../forms/helpers';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-approval-policy-mutation',
	templateUrl: './approval-policy-mutation.component.html',
	styleUrls: ['./approval-policy-mutation.component.scss']
})
export class ApprovalPolicyMutationComponent extends TranslationBaseComponent implements OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;
	public organization: IOrganization;

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
	public form: UntypedFormGroup = ApprovalPolicyMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [null, Validators.required],
			description: []
		});
	}

	constructor(
		private readonly dialogRef: NbDialogRef<ApprovalPolicyMutationComponent>,
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly fb: UntypedFormBuilder,
		public readonly translationService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	patchForm() {
		this.form.setValue({
			name: this.approvalPolicy ? this.approvalPolicy.name : '',
			description: this.approvalPolicy ? this.approvalPolicy.description : ''
		});
		this.form.updateValueAndValidity();
	}

	closeDialog(approvalPolicy?: IApprovalPolicy) {
		this.onReset();
		this.dialogRef.close(approvalPolicy);
	}

	async onSubmit() {
		if (this.form.invalid || !this.formDirective.submitted || !this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const approvalPolicy: IApprovalPolicyCreateInput = {
			tenantId,
			organizationId,
			...this.form.getRawValue(),
			...(this.approvalPolicy ? { id: this.approvalPolicy.id } : {})
		};
		try {
			const result: IApprovalPolicy = await this.approvalPolicyService.save(approvalPolicy);
			this.closeDialog(result);
		} catch (error) {
			console.error('Error while creating/updating approval policy', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Reset approval policy mutation form after save
	 */
	onReset() {
		this.formDirective.reset();
	}
}
