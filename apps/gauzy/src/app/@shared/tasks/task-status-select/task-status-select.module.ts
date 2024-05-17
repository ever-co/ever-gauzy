import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TaskStatusSelectComponent } from './task-status-select.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { TaskStatusesService } from '../../../@core/services';

@NgModule({
	declarations: [TaskStatusSelectComponent],
	exports: [TaskStatusSelectComponent],
	imports: [CommonModule, FormsModule, TranslateModule, NgSelectModule, SharedModule],
	providers: [TaskStatusesService]
})
export class TaskStatusSelectModule {}
