import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeSelectComponent } from './employee-multi-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [ThemeModule, NbSelectModule, ReactiveFormsModule, FormsModule, SharedModule, TranslateModule.forChild()],
	declarations: [EmployeeSelectComponent],
	exports: [EmployeeSelectComponent],
	providers: []
})
export class EmployeeMultiSelectModule {}
