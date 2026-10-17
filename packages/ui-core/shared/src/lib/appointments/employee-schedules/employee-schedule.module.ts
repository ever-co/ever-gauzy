import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EmployeeScheduleComponent } from './employee-schedule.component';

@NgModule({
	imports: [NbButtonModule, NbCardModule, TranslatePipe],
	exports: [EmployeeScheduleComponent],
	declarations: [EmployeeScheduleComponent]
})
export class EmployeeScheduleModule {}
