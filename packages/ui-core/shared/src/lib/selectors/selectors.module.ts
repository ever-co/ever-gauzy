import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCalendarKitModule,
	NbCalendarModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { NgxDaterangepickerMd as NgxDateRangePickerMd } from 'ngx-daterangepicker-material';
import { NgSelectModule } from '@ng-select/ng-select';
import { WeekDaysEnum } from '@gauzy/contracts';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { EmployeeStore, EmployeesService, OrganizationEditStore, OrganizationsService } from '@gauzy/ui-core/core';
import { DirectivesModule } from '../directives/directives.module';
import { DateSelectorComponent } from './date/date.component';
import { OrganizationSelectorComponent } from './organization/organization.component';
import { DateRangePickerComponent, dayOfWeekAsString } from './date-range-picker';
import { EmployeeSelectorComponent } from './employee/employee.component';
import { ProjectSelectModule } from './project/project.module';
import { TeamSelectModule } from './team/team.module';

const COMPONENTS = [
	DateRangePickerComponent,
	DateSelectorComponent,
	EmployeeSelectorComponent,
	OrganizationSelectorComponent
];

const MODULES = [ProjectSelectModule, TeamSelectModule];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NgxDateRangePickerMd.forRoot({
			firstDay: dayOfWeekAsString(WeekDaysEnum.MONDAY)
		}),
		NbButtonModule,
		NbCalendarKitModule,
		NbCalendarModule,
		NbCardModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		DirectivesModule,
		...MODULES
	],
	exports: [...COMPONENTS, ...MODULES],
	declarations: [...COMPONENTS],
	providers: [OrganizationsService, OrganizationEditStore, EmployeesService, EmployeeStore]
})
export class SelectorsModule {}
