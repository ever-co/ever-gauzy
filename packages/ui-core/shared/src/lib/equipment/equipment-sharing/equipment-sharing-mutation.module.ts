import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbRadioModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { Store } from '@gauzy/ui-core/common';
import { EquipmentService, EquipmentSharingPolicyService, EquipmentSharingService } from '@gauzy/ui-core/core';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { EquipmentSharingMutationComponent } from './equipment-sharing-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbSelectModule,
		NbDatepickerModule,
		NgSelectModule,
		NbRadioModule,
		I18nTranslateModule.forChild(),
		EmployeeMultiSelectModule
	],
	declarations: [EquipmentSharingMutationComponent],
	providers: [EquipmentSharingService, Store, EquipmentService, EquipmentSharingPolicyService]
})
export class EquipmentSharingMutationModule {}
