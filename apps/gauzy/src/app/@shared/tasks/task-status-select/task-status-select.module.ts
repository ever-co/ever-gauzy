import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TaskStatusSelectComponent } from './task-status-select.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { TaskStatusesService } from '@gauzy/ui-sdk/core';

@NgModule({
	declarations: [TaskStatusSelectComponent],
	exports: [TaskStatusSelectComponent],
	imports: [CommonModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule, SharedModule],
	providers: [TaskStatusesService]
})
export class TaskStatusSelectModule {}
