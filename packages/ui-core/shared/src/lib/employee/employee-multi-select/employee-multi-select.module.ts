import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { EmployeeSelectComponent } from './employee-multi-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [EmployeeSelectComponent],
	exports: [EmployeeSelectComponent]
})
export class EmployeeMultiSelectModule {}
