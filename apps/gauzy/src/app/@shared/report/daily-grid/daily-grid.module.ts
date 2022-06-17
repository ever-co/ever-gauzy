import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyGridComponent } from './daily-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule,
	NbAccordionModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FiltersModule } from '../../timesheet/filters/filters.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';

@NgModule({
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbAccordionModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		FiltersModule,
		FormsModule,
		ProjectColumnViewModule
	]
})
export class DailyGridModule {}
