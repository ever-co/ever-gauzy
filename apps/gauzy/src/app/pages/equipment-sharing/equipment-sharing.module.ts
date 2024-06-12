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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ApprovalPolicyService, EmployeesService, EquipmentSharingService } from '@gauzy/ui-sdk/core';
import {
	GauzyButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule,
	UserFormsModule
} from '@gauzy/ui-sdk/shared';
import { EquipmentSharingRoutingModule } from './equipment-sharing-routing.module';
import { EquipmentSharingComponent } from './equipment-sharing.component';
import { EquipmentSharingMutationModule } from '../../@shared/equipment-sharing/equipment-sharing-mutation.module';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';

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
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		EquipmentSharingMutationModule,
		TableComponentsModule,
		NbDatepickerModule,
		CardGridModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		NbSpinnerModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		NbTooltipModule
	],
	providers: [EquipmentSharingService, ApprovalPolicyService, EmployeesService],
	declarations: [EquipmentSharingComponent, EquipmentSharingActionComponent, EquipmentSharingStatusComponent]
})
export class EquipmentSharingModule {}
