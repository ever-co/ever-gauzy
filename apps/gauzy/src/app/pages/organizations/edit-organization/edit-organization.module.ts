import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbRouteTabsetModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { EditOrganizationRoutingModule } from './edit-organization-routing.module';
import { EditOrganizationComponent } from './edit-organization.component';
import { EditOrganizationSettingsModule } from './edit-organization-settings/edit-organization-settings.module';

@NgModule({
	imports: [
		CommonModule,
		EditOrganizationRoutingModule,
		NbCardModule,
		NbRouteTabsetModule,
		NbIconModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		// Brings `ngx-back-navigation`, which the card header renders.
		SharedModule,
		EditOrganizationSettingsModule
	],
	declarations: [EditOrganizationComponent],
	providers: []
})
export class EditOrganizationModule {}
