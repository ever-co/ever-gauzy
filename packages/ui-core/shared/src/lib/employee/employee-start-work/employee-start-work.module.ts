import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { PipesModule } from '../../pipes/pipes.module';
import { EmployeeStartWorkComponent } from './employee-start-work.component';

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
		PipesModule
	],
	declarations: [EmployeeStartWorkComponent],
	exports: [EmployeeStartWorkComponent]
})
export class EmployeeStartWorkModule {}
