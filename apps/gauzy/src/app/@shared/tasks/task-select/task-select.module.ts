import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskSelectorComponent } from './task/task.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [TaskSelectorComponent],
	exports: [TaskSelectorComponent],
	imports: [CommonModule, NgSelectModule, FormsModule, I18nTranslateModule.forChild()]
})
export class TaskSelectModule {}
