import { ThemeModule } from '../../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { EmployeeSchedulesComponent } from './employee-schedules.component';
import { TranslaterModule } from 'apps/gauzy/src/app/@shared/translater/translater.module';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbButtonModule, TranslaterModule],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	entryComponents: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
