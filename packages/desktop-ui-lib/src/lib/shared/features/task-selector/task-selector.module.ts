import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';

import { TaskSelectorQuery } from './+state/task-selector.query';
import { TaskSelectorService } from './+state/task-selector.service';
import { TaskSelectorStore } from './+state/task-selector.store';
import { TaskSelectorComponent } from './task-selector.component';

@NgModule({
    exports: [TaskSelectorComponent],
    imports: [CommonModule, TaskSelectorComponent],
    providers: [TaskSelectorStore, TaskSelectorQuery, TaskSelectorService, TimeTrackerQuery]
})
export class TaskSelectorModule {}
