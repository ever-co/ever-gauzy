import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbRouteTabsetModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
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
		TranslateModule,
		EditOrganizationSettingsModule
	],
	declarations: [EditOrganizationComponent],
	providers: []
})
export class EditOrganizationModule {}
