import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder } from '@angular/forms';
import {
	EquipmentSharing,
	Employee,
	Equipment,
	EquipmentSharingStatusEnum
} from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';

@Component({
	selector: 'ngx-equipment-mutation',
	templateUrl: './equipment-sharing-mutation.component.html',
	styleUrls: ['./equipment-sharing-mutation.component.scss']
})
export class EquipmentSharingMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	equipmentSharing: EquipmentSharing;
	employees: Employee[];
	teams: any[];
	equipmentItems: Equipment[];
	requestStatuses = Object.values(EquipmentSharingStatusEnum);
	requestStatus;

	constructor(
		public dialogRef: NbDialogRef<EquipmentSharingMutationComponent>,
		private equipmentSharingService: EquipmentSharingService,
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
			equipmentItem: [''],
			employee: [''],
			team: [''],
			shareRequestDate: [''],
			shareStartDate: [''],
			shareEndDate: [''],
			status: ['']
		});
	}

	async saveEquipment() {}

	async closeDialog(equipmentSharing?: EquipmentSharing) {
		this.dialogRef.close(equipmentSharing);
	}

	private setRequestStatus($event: any) {
		const selectedItem = this.equipmentItems.find((item) => {
			return item.id === $event.id;
		});

		if (selectedItem.autoApproveShare) {
			this.requestStatus = EquipmentSharingStatusEnum.APPROVED;
		} else {
			this.requestStatus = EquipmentSharingStatusEnum.REQUESTED;
		}
	}

	//todo disable either org or emp
	//status updated based on item
}
