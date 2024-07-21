import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TaskPrioritiesService } from '@gauzy/ui-core/core';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { TaskPrioritySelectComponent } from './task-priority-select.component';
import { TaskBadgeViewComponentModule } from '../task-badge-view/task-badge-view.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NgSelectModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		TaskBadgeViewComponentModule
	],
	declarations: [TaskPrioritySelectComponent],
	exports: [TaskPrioritySelectComponent],
	providers: [TaskPrioritiesService]
})
export class TaskPrioritySelectModule {}
