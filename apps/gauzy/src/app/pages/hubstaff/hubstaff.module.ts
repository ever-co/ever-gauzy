import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { HubstaffRoutingModule } from './hubstaff-routing.module';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgSelectModule } from '@ng-select/ng-select';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';

@NgModule({
	declarations: [HubstaffAuthorizeComponent, HubstaffComponent, SettingsDialogComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		HubstaffRoutingModule,
		NbButtonModule,
		NbTooltipModule,
		NbInputModule,
		NbIconModule,
		NbSpinnerModule,
		Angular2SmartTableModule,
		NgSelectModule,
		NbSelectModule,
		NbCheckboxModule,
		NbToggleModule,
		NbActionsModule,
		NbContextMenuModule,
		SharedModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild()
	]
})
export class HubstaffModule {}
