import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TaskSelectorComponent } from './task/task.component';

@NgModule({
	declarations: [TaskSelectorComponent],
	exports: [TaskSelectorComponent],
	imports: [CommonModule, FormsModule, NgSelectModule, I18nTranslateModule.forChild()]
})
export class TaskSelectModule {}
