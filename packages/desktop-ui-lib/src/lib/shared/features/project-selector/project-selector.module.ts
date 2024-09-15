import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { SelectModule } from '../../components/ui/select/select.module';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { ProjectSelectorQuery } from './+state/project-selector.query';
import { ProjectSelectorService } from './+state/project-selector.service';
import { ProjectSelectorStore } from './+state/project-selector.store';
import { ProjectSelectorComponent } from './project-selector.component';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule, SelectModule],
	providers: [
		ProjectSelectorStore,
		ProjectSelectorQuery,
		ProjectSelectorService,
		TaskSelectorService,
		TeamSelectorService,
		TimeTrackerQuery
	]
})
export class ProjectSelectorModule {}
