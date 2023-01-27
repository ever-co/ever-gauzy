import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { PrioritiesService } from '../../../@core/services';
import { TaskPrioritySelectComponent } from './task-priority-select.component';
import { TranslateModule } from '../../translate/translate.module';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [
		TaskPrioritySelectComponent
	],
	exports: [
		TaskPrioritySelectComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		TranslateModule,
		NgSelectModule,
		SharedModule
	],
	providers: [
		PrioritiesService
	]
})
export class TaskPrioritySelectModule { }
