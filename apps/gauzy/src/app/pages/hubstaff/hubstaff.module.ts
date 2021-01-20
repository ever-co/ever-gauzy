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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { ThemeModule } from '../../@theme/theme.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	declarations: [
		HubstaffAuthorizeComponent,
		HubstaffComponent,
		SettingsDialogComponent
	],
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
		Ng2SmartTableModule,
		NgSelectModule,
		NbSelectModule,
		NbCheckboxModule,
		NbToggleModule,
		NbActionsModule,
		NbContextMenuModule,
		ThemeModule,
		NbDatepickerModule,
		BackNavigationModule,
		NbDialogModule.forChild(),
		TranslaterModule
	],
	entryComponents: [SettingsDialogComponent]
})
export class HubstaffModule {}
