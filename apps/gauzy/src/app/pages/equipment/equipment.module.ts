import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionModule, PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { EquipmentComponent } from './equipment.component';
import { EquipmentMutationModule } from '../../@shared/equipment/equipment-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	imports: [
		CommonModule,
		EquipmentRoutingModule,
		SharedModule,
		UserFormsModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		Angular2SmartTableModule,
		NbDialogModule.forChild(),
		EquipmentMutationModule,
		TableComponentsModule,
		CardGridModule,
		I18nTranslateModule.forChild(),
		NbSpinnerModule,
		PaginationV2Module,
		GauzyButtonActionModule
	],
	declarations: [EquipmentComponent, AutoApproveComponent]
})
export class EquipmentModule {}
