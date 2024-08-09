import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	EquipmentMutationModule,
	SharedModule,
	TableComponentsModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { EquipmentComponent } from './equipment.component';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';

@NgModule({
	imports: [
		EquipmentRoutingModule,
		SharedModule,
		UserFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbDialogModule.forChild(),
		EquipmentMutationModule,
		TableComponentsModule,
		TranslateModule.forChild(),
		NbSpinnerModule,
		SmartDataViewLayoutModule
	],
	declarations: [EquipmentComponent, AutoApproveComponent]
})
export class EquipmentModule {}
