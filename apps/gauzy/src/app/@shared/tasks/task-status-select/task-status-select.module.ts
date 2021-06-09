import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import { TaskStatusSelectComponent } from './task-status-select.component';
import { FormsModule } from '@angular/forms';

@NgModule({
	declarations: [
		TaskStatusSelectComponent
	],
	exports: [
		TaskStatusSelectComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
		NgSelectModule
	]
})
export class TaskStatusSelectModule {}
