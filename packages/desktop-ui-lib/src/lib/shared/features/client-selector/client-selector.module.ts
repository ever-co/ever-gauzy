import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { SelectModule } from '../../components/ui/select/select.module';
import { ProjectSelectorService } from '../project-selector/+state/project-selector.service';
import { TaskSelectorService } from '../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { ClientSelectorQuery } from './+state/client-selector.query';
import { ClientSelectorService } from './+state/client-selector.service';
import { ClientSelectorStore } from './+state/client-selector.store';
import { ClientSelectorComponent } from './client-selector.component';

@NgModule({
	declarations: [ClientSelectorComponent],
	exports: [ClientSelectorComponent],
	imports: [CommonModule, SelectModule],
	providers: [
		ClientSelectorStore,
		ClientSelectorQuery,
		ClientSelectorService,
		ProjectSelectorService,
		TaskSelectorService,
		TeamSelectorService,
		TimeTrackerQuery
	]
})
export class ClientSelectorModule {}
