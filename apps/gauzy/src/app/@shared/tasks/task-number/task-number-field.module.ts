import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TaskNumberFieldComponent } from './task-number-field.component';
import { NbInputModule } from '@nebular/theme';

@NgModule({
	declarations: [TaskNumberFieldComponent],
	exports: [TaskNumberFieldComponent],
	imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, NbInputModule]
})
export class TaskNumberFieldModule {}
