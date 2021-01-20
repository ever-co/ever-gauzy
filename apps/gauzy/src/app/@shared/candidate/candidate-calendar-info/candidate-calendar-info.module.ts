import { NgModule } from '@angular/core';
import { NbIconModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { CandidateCalendarInfoComponent } from './candidate-calendar-info.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		FullCalendarModule,
		TranslaterModule
	],
	exports: [CandidateCalendarInfoComponent],
	declarations: [CandidateCalendarInfoComponent],
	entryComponents: [CandidateCalendarInfoComponent]
})
export class CandidateCalendarInfoModule {}
