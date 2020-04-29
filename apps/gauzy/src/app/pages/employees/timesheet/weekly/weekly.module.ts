// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeeklyRoutingModule } from './weekly-routing.module';
import { WeeklyComponent } from './weekly/weekly.component';
import { TranslateModule } from '@ngx-translate/core';
import { ShareModule } from 'apps/gauzy/src/app/share/share.module';
import {
	NbDatepickerModule,
	NbIconModule,
	NbButtonModule
} from '@nebular/theme';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';

@NgModule({
	declarations: [WeeklyComponent],
	imports: [
		CommonModule,
		WeeklyRoutingModule,
		TranslateModule,
		ShareModule,
		NbDatepickerModule,
		NbIconModule,
		EmployeeSelectorsModule,
		FormsModule,
		NbButtonModule,
		SharedModule
	]
})
export class WeeklyModule {}
