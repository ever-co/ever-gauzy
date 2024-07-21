import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbDatepickerModule, NbInputModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { EmployeeEndWorkComponent } from './employee-end-work.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		NbDatepickerModule,
		NbInputModule,
		I18nTranslateModule.forChild()
	],
	exports: [EmployeeEndWorkComponent],
	declarations: [EmployeeEndWorkComponent],
	providers: []
})
export class EmployeeEndWorkModule {}
