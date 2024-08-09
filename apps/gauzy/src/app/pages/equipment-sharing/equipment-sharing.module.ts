import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbDatepickerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { ApprovalPolicyService, EmployeesService, EquipmentSharingService } from '@gauzy/ui-core/core';
import {
	AngularSmartTableModule,
	CardGridModule,
	EquipmentSharingMutationModule,
	SharedModule,
	TableComponentsModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { EquipmentSharingRoutingModule } from './equipment-sharing-routing.module';
import { EquipmentSharingComponent } from './equipment-sharing.component';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		EquipmentSharingRoutingModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbDialogModule.forChild(),
		EquipmentSharingMutationModule,
		TableComponentsModule,
		NbDatepickerModule,
		CardGridModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		NbSpinnerModule,
		AngularSmartTableModule,
		NbTooltipModule
	],
	providers: [EquipmentSharingService, ApprovalPolicyService, EmployeesService],
	declarations: [EquipmentSharingComponent, EquipmentSharingActionComponent, EquipmentSharingStatusComponent]
})
export class EquipmentSharingModule {}
