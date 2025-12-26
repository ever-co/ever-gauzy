import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
	NbAccordionModule,
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbListModule,
	NbMenuModule,
	NbProgressBarModule,
	NbSelectModule,
	NbSidebarModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToastrService,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { Store } from '../services';
import { SwitchThemeModule } from '../theme-selector/switch-theme/switch-theme.module';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { TaskRenderModule } from '../time-tracker/task-render';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { SettingsComponent } from './settings.component';
import { SslModule } from './ssl';

@NgModule({
	declarations: [SettingsComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbSidebarModule,
		NbMenuModule.forRoot(),
		NbCardModule,
		NbIconModule,
		NbListModule,
		NbSelectModule,
		NbFormFieldModule,
		FormsModule,
		NbToggleModule,
		NbInputModule,
		NbButtonModule,
		NbAlertModule,
		NbProgressBarModule,
		NbTabsetModule,
		NbAccordionModule,
		NbTooltipModule,
		NbSpinnerModule,
		DesktopDirectiveModule,
		LanguageModule.forChild(),
		TaskRenderModule,
		SslModule,
		PipeModule,
		SwitchThemeModule
	],
	providers: [NbToastrService, TimeTrackerService, NbDialogService, Store],
	exports: [SettingsComponent]
})
export class SettingsModule {}
