import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TaskSizesService } from '../../../@core/services';
import { TaskSizeSelectComponent } from './task-size-select.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [TaskSizeSelectComponent],
	exports: [TaskSizeSelectComponent],
	imports: [CommonModule, FormsModule, TranslateModule.forChild(), NgSelectModule, SharedModule],
	providers: [TaskSizesService]
})
export class TaskSizeSelectModule {}
