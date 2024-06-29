import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { EmployeeSchedulesComponent } from './employee-schedules.component';

@NgModule({
	imports: [NbButtonModule, NbCardModule, I18nTranslateModule.forChild()],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
