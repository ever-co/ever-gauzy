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

import { LanguageModule } from '../language/language.module';
import { Store } from '../services';

import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { TaskRenderModule } from '../time-tracker/task-render';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { SslModule } from './ssl';

@NgModule({
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
		LanguageModule.forChild(),
		TaskRenderModule,
		SslModule,
		PipeModule
	],
	providers: [NbToastrService, TimeTrackerService, NbDialogService, Store]
})
export class SettingsModule {}
