import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbButtonModule, NbCardModule, NbDatepickerModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { EmployeeStartWorkComponent } from './employee-start-work.component';

@NgModule({
	declarations: [EmployeeStartWorkComponent],
	exports: [EmployeeStartWorkComponent],
	imports: [
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbDatepickerModule,
		NbInputModule,
		I18nTranslateModule.forChild()
	]
})
export class EmployeeStartWorkModule {}
