import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CandidateCalendarInfoComponent } from './candidate-calendar-info.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		FullCalendarModule,
		TranslateModule.forChild()
	],
	exports: [CandidateCalendarInfoComponent],
	declarations: [CandidateCalendarInfoComponent]
})
export class CandidateCalendarInfoModule {}
