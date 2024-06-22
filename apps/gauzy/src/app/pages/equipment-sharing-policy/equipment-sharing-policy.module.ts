import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	EquipmentSharingPolicyMutationModule,
	i4netButtonActionModule,
	PaginationV2Module,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { EquipmentSharingPolicyComponent } from './equipment-sharing-policy.component';
import { EquipmentSharingPolicyRoutingModule } from './equipment-sharing-policy.routing.module';

@NgModule({
	imports: [
		CommonModule,
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
		Angular2SmartTableModule,
		NbTooltipModule,
		NbRadioModule,
		CardGridModule,
		EquipmentSharingPolicyMutationModule,
		EquipmentSharingPolicyRoutingModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		i4netButtonActionModule,
		PaginationV2Module,
		TableComponentsModule
	],
	declarations: [EquipmentSharingPolicyComponent]
})
export class EquipmentSharingPolicyModule { }
