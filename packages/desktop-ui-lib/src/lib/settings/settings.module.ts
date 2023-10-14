import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsComponent } from './settings.component';
import {
	NbLayoutModule,
	NbSidebarModule,
	NbMenuModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbSelectModule,
	NbToggleModule,
	NbInputModule,
	NbButtonModule,
	NbAlertModule,
	NbProgressBarModule,
	NbTabsetModule,
	NbToastrService,
	NbAccordionModule,
	NbTooltipModule,
	NbSpinnerModule,
	NbDialogService
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { TranslateModule } from '@ngx-translate/core';
import { Store } from '../services';
import { LanguageSelectorService } from '../language/language-selector.service';
import {TaskRenderModule} from "../time-tracker/task-render";

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
		LanguageModule,
		TranslateModule,
		TaskRenderModule
	],
	providers: [
		NbToastrService,
		TimeTrackerService,
		NbDialogService,
		Store,
		LanguageSelectorService
	],
	exports: [SettingsComponent]
})
export class SettingsModule {}
