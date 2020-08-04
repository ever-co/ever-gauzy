import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EquipmentSharingPolicy } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharingPolicyService } from '../../@core/services/equipment-sharing-policy.service';

@Component({
	selector: 'ngx-equipment-sharing-policy-mutation',
	templateUrl: './equipment-sharing-policy-mutation.component.html'
})
export class EquipmentSharingPolicyMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	equipmentSharingPolicy: EquipmentSharingPolicy;
	organizationId: string;
	isHasType = true;

	constructor(
		public dialogRef: NbDialogRef<EquipmentSharingPolicyMutationComponent>,
		private equipmentSharingPolicyService: EquipmentSharingPolicyService,
		private fb: FormBuilder,
		readonly translationService: TranslateService
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.initializeForm();
	}

	async initializeForm() {
		this.form = this.fb.group({
			name: [
				this.equipmentSharingPolicy
					? this.equipmentSharingPolicy.name
					: '',
				Validators.required
			],
			description: [
				this.equipmentSharingPolicy
					? this.equipmentSharingPolicy.description
					: ''
			],
			organizationId: [
				this.equipmentSharingPolicy
					? this.equipmentSharingPolicy.organizationId
					: ''
			],
			id: [
				this.equipmentSharingPolicy
					? this.equipmentSharingPolicy.id
					: null
			]
		});
	}

	async closeDialog(requipmentSharingPolicy?: EquipmentSharingPolicy) {
		this.dialogRef.close(requipmentSharingPolicy);
	}

	async saveEquipmentSharingPolicy() {
		const equipPolicy: EquipmentSharingPolicy = {
			name: this.form.value['name'],
			description: this.form.value['description'],
			organizationId: this.organizationId,
			id: this.form.value['id']
		};

		let result: EquipmentSharingPolicy;
		result = await this.equipmentSharingPolicyService.save(equipPolicy);

		this.closeDialog(result);
	}
}
