import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { EmployeeEndWorkComponent } from './employee-end-work.component';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		NbDatepickerModule,
		NbInputModule,
		TranslateModule
	],
	exports: [EmployeeEndWorkComponent],
	declarations: [EmployeeEndWorkComponent],
	providers: []
})
export class EmployeeEndWorkModule {}
