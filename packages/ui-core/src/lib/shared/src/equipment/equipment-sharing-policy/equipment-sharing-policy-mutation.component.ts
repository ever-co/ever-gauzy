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
	styleUrls: ['./equipment-sharing-policy-mutation.component.scss']
})
export class EquipmentSharingPolicyMutationComponent extends TranslationBaseComponent implements OnInit {
	form: UntypedFormGroup;
	equipmentSharingPolicy: IEquipmentSharingPolicy;
	isHasType = true;
	selectedOrganization: IOrganization;

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

	async initializeForm() {
		this.form = this.fb.group({
			name: [this.equipmentSharingPolicy ? this.equipmentSharingPolicy.name : '', Validators.required],
			description: [this.equipmentSharingPolicy ? this.equipmentSharingPolicy.description : ''],
			organizationId: [this.equipmentSharingPolicy ? this.equipmentSharingPolicy.organizationId : ''],
			id: [this.equipmentSharingPolicy ? this.equipmentSharingPolicy.id : null]
		});
	}

	async closeDialog(requipmentSharingPolicy?: IEquipmentSharingPolicy) {
		this.dialogRef.close(requipmentSharingPolicy);
	}

	async saveEquipmentSharingPolicy() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const equipPolicy: IEquipmentSharingPolicy = {
			name: this.form.value['name'],
			description: this.form.value['description'],
			id: this.form.value['id'],
			organizationId,
			tenantId
		};

		let result: IEquipmentSharingPolicy;
		result = await this.equipmentSharingPolicyService.save(equipPolicy);

		this.closeDialog(result);
	}
}
