// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateSpecificAvailibilityRouteModule } from './date-specific-availibility.routing.module';
import { DateSpecificAvailibilityComponent } from './date-specific-availibility.component';
import { ShareModule } from 'apps/gauzy/src/app/share/share.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { NbDialogModule, NbCardModule, NbButtonModule } from '@nebular/theme';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';

@NgModule({
	declarations: [DateSpecificAvailibilityComponent],
	imports: [
		CommonModule,
		DateSpecificAvailibilityRouteModule,
		ShareModule,
		FullCalendarModule,
		TranslateModule,
		EmployeeSelectorsModule,
		NbDialogModule,
		SharedModule,
		NbCardModule,
		NbButtonModule
	]
})
export class DateSpecificAvailibilityModule {}
