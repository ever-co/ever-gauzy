import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TaskSizesService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { TaskSizeSelectComponent } from './task-size-select.component';
import { TaskBadgeViewComponentModule } from '../task-badge-view/task-badge-view.module';

@NgModule({
	imports: [CommonModule, FormsModule, NgSelectModule, I18nTranslateModule.forChild(), TaskBadgeViewComponentModule],
	declarations: [TaskSizeSelectComponent],
	exports: [TaskSizeSelectComponent],
	providers: [TaskSizesService]
})
export class TaskSizeSelectModule {}
