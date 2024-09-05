import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TaskSelectorComponent } from './task-selector.component';

@NgModule({
	declarations: [TaskSelectorComponent],
	exports: [TaskSelectorComponent],
	imports: [CommonModule]
})
export class TaskSelectorModule {}
