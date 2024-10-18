import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { TaskStatusesService } from '@gauzy/ui-core/core';
import { TaskBadgeViewComponentModule } from '../task-badge-view/task-badge-view.module';
import { TaskStatusSelectComponent } from './task-status-select.component';

@NgModule({
	imports: [CommonModule, FormsModule, NgSelectModule, TranslateModule.forChild(), TaskBadgeViewComponentModule],
	declarations: [TaskStatusSelectComponent],
	exports: [TaskStatusSelectComponent],
	providers: [TaskStatusesService]
})
export class TaskStatusSelectModule {}
