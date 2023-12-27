import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FiltersComponent } from './filters.component';
import { FormsModule } from '@angular/forms';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import {
	NbButtonModule,
	NbPopoverModule,
	NbSelectModule,
	NbDatepickerModule,
	NbIconModule,
	NbCalendarRangeModule,
	NbInputModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { SharedModule } from '../../shared.module';
import { ProjectSelectModule } from '../../project-select/project-select.module';

@NgModule({
	declarations: [FiltersComponent],
	exports: [FiltersComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCalendarRangeModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbPopoverModule,
		NbSelectModule,
		NgxSliderModule,
		SharedModule,
		TranslateModule,
		EmployeeMultiSelectModule,
		ProjectSelectModule
	]
})
export class FiltersModule { }
