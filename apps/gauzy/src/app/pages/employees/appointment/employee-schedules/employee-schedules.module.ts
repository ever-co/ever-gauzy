import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule } from '../../../../@theme/theme.module';
import { EmployeeSchedulesComponent } from './employee-schedules.component';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbButtonModule, I18nTranslateModule.forChild()],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
