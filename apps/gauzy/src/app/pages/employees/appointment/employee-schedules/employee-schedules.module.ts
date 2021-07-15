import { ThemeModule } from '../../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { EmployeeSchedulesComponent } from './employee-schedules.component';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbButtonModule, TranslateModule],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
