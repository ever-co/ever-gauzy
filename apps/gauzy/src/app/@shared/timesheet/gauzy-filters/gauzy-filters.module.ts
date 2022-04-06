import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GauzyFiltersComponent } from './gauzy-filters.component';
import { SharedModule } from '../../shared.module';
import { FormsModule } from '@angular/forms';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import {
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbOptionModule,
	NbPopoverModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
import { Ng5SliderModule } from 'ng5-slider';
import { ProjectSelectModule } from '../../project-select/project-select.module';

@NgModule({
	declarations: [
		GauzyFiltersComponent
	],
	exports: [
		GauzyFiltersComponent
	],
	imports: [
		CommonModule,
		SharedModule,
		FormsModule,
		NgxDaterangepickerMd,
		NbInputModule,
		NbButtonModule,
		TranslateModule,
		NbIconModule,
		EmployeeMultiSelectModule,
		NbPopoverModule,
		NbSelectModule,
		Ng5SliderModule,
		ProjectSelectModule,
		NbOptionModule
	]
})
export class GauzyFiltersModule { }
