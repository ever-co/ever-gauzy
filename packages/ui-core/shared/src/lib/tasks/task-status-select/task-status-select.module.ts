import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { TaskStatusesService } from '@gauzy/ui-core/core';
import { TaskStatusSelectComponent } from './task-status-select.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbIconModule, NgSelectModule, TranslatePipe],
	declarations: [TaskStatusSelectComponent],
	exports: [TaskStatusSelectComponent],
	providers: [TaskStatusesService]
})
export class TaskStatusSelectModule {}
