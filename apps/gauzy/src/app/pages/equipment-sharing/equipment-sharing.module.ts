import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EquipmentSharingRoutingModule } from './equipment-sharing-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
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
import { FormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { EquipmentSharingComponent } from './equipment-sharing.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { EquipmentSharingMutationModule } from '../../@shared/equipment-sharing/equipment-sharing-mutation.module';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeesService } from '../../@core/services';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		SharedModule,
		EquipmentSharingRoutingModule,
		ThemeModule,
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
		BackNavigationModule,
		TranslateModule,
		NbSpinnerModule,
		HeaderTitleModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		NbTooltipModule
	],
	providers: [EquipmentSharingService, ApprovalPolicyService, EmployeesService],
	declarations: [EquipmentSharingComponent, EquipmentSharingActionComponent, EquipmentSharingStatusComponent]
})
export class EquipmentSharingModule {}
