import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { IEquipmentSharingPolicy, IOrganization } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharingPolicyService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ngx-equipment-sharing-policy-mutation',
    templateUrl: './equipment-sharing-policy-mutation.component.html',
    styleUrls: ['./equipment-sharing-policy-mutation.component.scss'],
    standalone: false
})
export class EquipmentSharingPolicyMutationComponent extends TranslationBaseComponent implements OnInit {
	equipmentSharingPolicy: IEquipmentSharingPolicy;
	selectedOrganization: IOrganization;
	/** True while the save request is in flight: the Save button is disabled so a second click cannot create the policy twice. */
	loading = false;
	form: UntypedFormGroup = this.fb.group({
		name: [null, Validators.required],
		description: []
	});

	constructor(
		public dialogRef: NbDialogRef<EquipmentSharingPolicyMutationComponent>,
		private equipmentSharingPolicyService: EquipmentSharingPolicyService,
		private fb: UntypedFormBuilder,
		readonly translationService: TranslateService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.initializeForm();
	}

	/**
	 * Initialize the form with values from the existing equipment sharing policy.
	 * If no policy exists, the form fields are set to empty strings.
	 */
	async initializeForm() {
		this.form.patchValue({
			name: this.equipmentSharingPolicy ? this.equipmentSharingPolicy.name : '',
			description: this.equipmentSharingPolicy ? this.equipmentSharingPolicy.description : ''
		});
	}

	/**
	 * Close the dialog with the given equipment sharing policy.
	 * If no policy is provided, the dialog closes without passing any data.
	 *
	 * @param policy - The equipment sharing policy to pass when closing the dialog.
	 */
	async closeDialog(policy?: IEquipmentSharingPolicy) {
		this.dialogRef.close(policy);
	}

	/**
	 * Save the equipment sharing policy.
	 * Determines whether to create a new policy or update an existing one based on the presence of an ID.
	 */
	async saveEquipmentSharingPolicy() {
		if (this.loading) {
			return;
		}
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { name, description } = this.form.value;

		// Create an Equipment Sharing Policy object
		const equipmentSharingPolicy: IEquipmentSharingPolicy = {
			name,
			description,
			organizationId,
			tenantId
		};

		let equipmentPolicy: IEquipmentSharingPolicy;

		this.loading = true;
		try {
			if (this.equipmentSharingPolicy) {
				const { id } = this.equipmentSharingPolicy;
				// Update existing policy
				equipmentPolicy = await this.equipmentSharingPolicyService.update(id, equipmentSharingPolicy);
			} else {
				// Create new policy
				equipmentPolicy = await this.equipmentSharingPolicyService.create(equipmentSharingPolicy);
			}

			// Close the dialog and pass the created/updated policy
			this.closeDialog(equipmentPolicy);
		} finally {
			// Re-enable the button whether the request succeeded or failed, so a failed save can be retried.
			this.loading = false;
		}
	}
}
