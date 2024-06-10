import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PipesModule } from '@gauzy/ui-sdk/shared';
import { TaskBadgeViewComponent } from './task-badge-view.component';

@NgModule({
	imports: [CommonModule, PipesModule],
	declarations: [TaskBadgeViewComponent],
	exports: [TaskBadgeViewComponent]
})
export class TaskBadgeViewComponentModule {}
