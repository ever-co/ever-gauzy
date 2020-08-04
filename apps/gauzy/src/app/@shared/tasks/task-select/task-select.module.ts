import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskSelectorComponent } from './task/task.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [TaskSelectorComponent],
	exports: [TaskSelectorComponent],
	imports: [CommonModule, NgSelectModule, FormsModule, TranslateModule]
})
export class TaskSelectModule {}
