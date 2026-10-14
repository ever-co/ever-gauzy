import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EquipmentMutationModule,
	SharedModule,
	TableComponentsModule,
	UserFormsModule,
	FavoriteToggleModule
} from '@gauzy/ui-core/shared';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { EquipmentComponent } from './equipment.component';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';

@NgModule({
	imports: [
		FavoriteToggleModule,
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
		CardGridModule,
		TranslatePipe,
		NbSpinnerModule,
		SmartDataViewLayoutModule
	],
	declarations: [EquipmentComponent, AutoApproveComponent]
})
export class EquipmentModule {}
