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
import { NgxSliderModule } from '@angular-slider/ngx-slider';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';
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
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbOptionModule,
		NbPopoverModule,
		NbSelectModule,
		NgxDaterangepickerMd,
		NgxSliderModule,
		SharedModule,
		TranslateModule,
		EmployeeMultiSelectModule,
		ProjectSelectModule,
	]
})
export class GauzyFiltersModule { }
