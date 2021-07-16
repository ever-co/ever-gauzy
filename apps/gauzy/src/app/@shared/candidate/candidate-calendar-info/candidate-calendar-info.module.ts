import { NgModule } from '@angular/core';
import { NbIconModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { CandidateCalendarInfoComponent } from './candidate-calendar-info.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		FullCalendarModule,
		TranslateModule
	],
	exports: [CandidateCalendarInfoComponent],
	declarations: [CandidateCalendarInfoComponent]
})
export class CandidateCalendarInfoModule {}
