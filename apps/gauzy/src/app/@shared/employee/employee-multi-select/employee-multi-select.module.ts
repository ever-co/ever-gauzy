import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeSelectComponent } from './employee-multi-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		ThemeModule,
		NbSelectModule,
		ReactiveFormsModule,
		FormsModule,
		SharedModule,
		I18nTranslateModule.forChild()
	],
	declarations: [EmployeeSelectComponent],
	exports: [EmployeeSelectComponent],
	providers: []
})
export class EmployeeMultiSelectModule {}
