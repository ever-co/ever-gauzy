import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeSchedulesComponent } from './employee-schedules.component';

@NgModule({
	imports: [NbButtonModule, NbCardModule, TranslateModule.forChild()],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
