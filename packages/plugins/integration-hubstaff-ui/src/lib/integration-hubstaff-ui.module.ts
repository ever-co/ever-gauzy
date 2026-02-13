import { NgModule } from '@angular/core';

import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { IntegrationHubstaffRoutes } from './integration-hubstaff.routes';
import { IntegrationHubstaffLayoutComponent } from './integration-hubstaff.layout.component';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

@NgModule({
	declarations: [
		IntegrationHubstaffLayoutComponent,
		HubstaffAuthorizeComponent,
		HubstaffComponent,
		SettingsDialogComponent
	],
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		NgSelectModule,
		NgxPermissionsModule.forRoot(),
		TranslateModule.forChild(),
		IntegrationHubstaffRoutes,
		SharedModule,
		SmartDataViewLayoutModule
	]
})
export class IntegrationHubstaffModule {}
