import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskBadgeViewComponent } from './task-badge-view.component';
import { ReplacePipe } from '../../pipes/replace.pipe';

@NgModule({
	imports: [CommonModule, ReplacePipe],
	declarations: [TaskBadgeViewComponent],
	exports: [TaskBadgeViewComponent]
})
export class TaskBadgeViewComponentModule {}
