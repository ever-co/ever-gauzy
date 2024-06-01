import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../../@theme/theme.module';
import { EmployeeSchedulesComponent } from './employee-schedules.component';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbButtonModule, TranslateModule.forChild()],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
