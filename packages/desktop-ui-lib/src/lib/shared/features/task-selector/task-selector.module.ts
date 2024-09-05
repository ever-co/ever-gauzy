import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SelectModule } from '../../components/ui/select/select.module';
import { TaskSelectorComponent } from './task-selector.component';

@NgModule({
	declarations: [TaskSelectorComponent],
	exports: [TaskSelectorComponent],
	imports: [CommonModule, SelectModule]
})
export class TaskSelectorModule {}
