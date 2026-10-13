import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { EmployeeSelectComponent } from './employee-multi-select.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [CommonModule, FormsModule, ReactiveFormsModule, NbSelectModule, TranslatePipe, SharedModule],
	declarations: [EmployeeSelectComponent],
	exports: [EmployeeSelectComponent]
})
export class EmployeeMultiSelectModule {}
