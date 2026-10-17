import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TaskNumberFieldComponent } from './task-number-field.component';
import { NbInputModule } from '@nebular/theme';

@NgModule({
	declarations: [TaskNumberFieldComponent],
	exports: [TaskNumberFieldComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslatePipe, NbInputModule]
})
export class TaskNumberFieldModule {}
