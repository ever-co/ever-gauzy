import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeScheduleComponent } from './employee-schedule.component';

@NgModule({
	imports: [NbButtonModule, NbCardModule, TranslateModule.forChild()],
	exports: [EmployeeScheduleComponent],
	declarations: [EmployeeScheduleComponent]
})
export class EmployeeScheduleModule {}
