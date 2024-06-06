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
import { EquipmentSharingMutationModule } from '../../@shared/equipment-sharing/equipment-sharing-mutation.module';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ApprovalPolicyService, EmployeesService, EquipmentSharingService } from '@gauzy/ui-sdk/core';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
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
