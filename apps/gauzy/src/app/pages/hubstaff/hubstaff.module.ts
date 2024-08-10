import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbSelectModule,
	NbCheckboxModule,
	NbToggleModule,
	NbDialogModule,
	NbDatepickerModule,
	NbTooltipModule,
	NbActionsModule,
	NbContextMenuModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { HubstaffRoutingModule } from './hubstaff-routing.module';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

@NgModule({
	declarations: [HubstaffAuthorizeComponent, HubstaffComponent, SettingsDialogComponent],
	imports: [
		NbCardModule,
		HubstaffRoutingModule,
		NbButtonModule,
		NbTooltipModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		NgSelectModule,
		NbSelectModule,
		NbCheckboxModule,
		NbToggleModule,
		NbActionsModule,
		NbContextMenuModule,
		NgxPermissionsModule.forChild(),
		SharedModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		SmartDataViewLayoutModule
	]
})
export class HubstaffModule {}
