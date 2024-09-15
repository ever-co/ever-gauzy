import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { SelectModule } from '../../components/ui/select/select.module';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorQuery } from './+state/team-selector.query';
import { TeamSelectorService } from './+state/team-selector.service';
import { TeamSelectorStore } from './+state/team-selector.store';
import { TeamSelectorComponent } from './team-selector.component';

@NgModule({
	declarations: [TeamSelectorComponent],
	exports: [TeamSelectorComponent],
	imports: [CommonModule, SelectModule],
	providers: [
		TeamSelectorStore,
		TeamSelectorQuery,
		TeamSelectorService,
		ProjectSelectorService,
		TaskSelectorService,
		TimeTrackerQuery
	]
})
export class TeamSelectorModule {}
