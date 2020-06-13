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
	NbIconModule
} from '@nebular/theme';
import { Ng5SliderModule } from 'ng5-slider';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [FiltersComponent],
	exports: [FiltersComponent],
	imports: [
		CommonModule,
		FormsModule,
		EmployeeMultiSelectModule,
		NbButtonModule,
		NbPopoverModule,
		NbSelectModule,
		NbDatepickerModule,
		NbIconModule,
		Ng5SliderModule,
		TranslateModule
	]
})
export class FiltersModule {}
