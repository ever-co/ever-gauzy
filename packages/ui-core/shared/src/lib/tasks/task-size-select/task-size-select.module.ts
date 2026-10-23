import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TaskSizesService } from '@gauzy/ui-core/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TaskSizeSelectComponent } from './task-size-select.component';
import { TaskBadgeViewComponentModule } from '../task-badge-view/task-badge-view.module';

@NgModule({
	imports: [CommonModule, FormsModule, NgSelectModule, TranslatePipe, TaskBadgeViewComponentModule],
	declarations: [TaskSizeSelectComponent],
	exports: [TaskSizeSelectComponent],
	providers: [TaskSizesService]
})
export class TaskSizeSelectModule {}
