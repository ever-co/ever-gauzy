import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CandidateCalendarInfoComponent } from './candidate-calendar-info.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		FullCalendarModule,
		I18nTranslateModule.forChild()
	],
	exports: [CandidateCalendarInfoComponent],
	declarations: [CandidateCalendarInfoComponent]
})
export class CandidateCalendarInfoModule {}
