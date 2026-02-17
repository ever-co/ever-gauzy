import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbInputModule, NbDatepickerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
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
		TranslateModule.forChild()
	],
	declarations: [EmployeeStartWorkComponent],
	exports: [EmployeeStartWorkComponent]
})
export class EmployeeStartWorkModule {}
