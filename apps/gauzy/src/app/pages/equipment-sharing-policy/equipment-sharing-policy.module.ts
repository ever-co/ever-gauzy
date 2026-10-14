import { NgModule } from '@angular/core';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbRadioModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EquipmentSharingPolicyMutationModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { EquipmentSharingPolicyComponent } from './equipment-sharing-policy.component';
import { EquipmentSharingPolicyRoutingModule } from './equipment-sharing-policy.routing.module';

@NgModule({
	imports: [
		SharedModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbRadioModule,
		CardGridModule,
		EquipmentSharingPolicyMutationModule,
		EquipmentSharingPolicyRoutingModule,
		TranslatePipe,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	declarations: [EquipmentSharingPolicyComponent]
})
export class EquipmentSharingPolicyModule {}
