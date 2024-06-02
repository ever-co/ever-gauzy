import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { NgModule } from '@angular/core';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { EquipmentComponent } from './equipment.component';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationModule } from '../../@shared/equipment/equipment-mutation.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';

@NgModule({
	imports: [
		EquipmentRoutingModule,
		ThemeModule,
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
		HeaderTitleModule,
		PaginationV2Module,
		GauzyButtonActionModule
	],
	providers: [EquipmentService],
	declarations: [EquipmentComponent, AutoApproveComponent]
})
export class EquipmentModule {}
