import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { PipesModule } from '@gauzy/ui-sdk/shared';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EmployeeStartWorkComponent } from './employee-start-work.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbDatepickerModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		PipesModule
	],
	declarations: [EmployeeStartWorkComponent],
	exports: [EmployeeStartWorkComponent]
})
export class EmployeeStartWorkModule {}
