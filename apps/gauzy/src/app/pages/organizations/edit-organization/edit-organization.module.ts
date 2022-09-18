import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '../../../@shared/translate/translate.module';
import { EditOrganizationRoutingModule } from './edit-organization-routing.module';
import { EditOrganizationComponent } from './edit-organization.component';
import { EditOrganizationSettingsModule } from './edit-organization-settings/edit-organization-settings.module';

@NgModule({
	imports: [
		CommonModule,
		EditOrganizationRoutingModule,
		NbCardModule,
		NbRouteTabsetModule,
		NgxPermissionsModule.forChild(),
		TranslateModule,
		EditOrganizationSettingsModule
	],
	declarations: [EditOrganizationComponent],
	providers: []
})
export class EditOrganizationModule {}
