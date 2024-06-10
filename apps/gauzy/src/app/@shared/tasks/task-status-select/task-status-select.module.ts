import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TaskStatusSelectComponent } from './task-status-select.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TaskStatusesService } from '@gauzy/ui-sdk/core';
import { PipesModule } from '@gauzy/ui-sdk/shared';
import { TaskBadgeViewComponentModule } from '../task-badge-view/task-badge-view.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		PipesModule,
		TaskBadgeViewComponentModule
	],
	declarations: [TaskStatusSelectComponent],
	exports: [TaskStatusSelectComponent],
	providers: [TaskStatusesService]
})
export class TaskStatusSelectModule {}
