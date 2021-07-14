import { NgModule } from '@angular/core';
import { EquipmentSharingRoutingModule } from './equipment-sharing-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbDatepickerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
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
import { TranslateModule } from '../../@shared/translate/translate.module';
import { EmployeesService } from '../../@core/services';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';

@NgModule({
	imports: [
		EquipmentSharingRoutingModule,
		ThemeModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		EquipmentSharingMutationModule,
		TableComponentsModule,
		NbDatepickerModule,
		CardGridModule,
		BackNavigationModule,
		TranslateModule,
		NbSpinnerModule,
		HeaderTitleModule
	],
	providers: [
		EquipmentSharingService,
		ApprovalPolicyService,
		EmployeesService
	],
	declarations: [
		EquipmentSharingComponent,
		EquipmentSharingActionComponent,
		EquipmentSharingStatusComponent
	]
})
export class EquipmentSharingModule {}
