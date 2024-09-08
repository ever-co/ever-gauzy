import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { TimeTrackerStore } from '../../../time-tracker/+state/time-tracker.store';
import { ClientSelectorModule } from '../client-selector/client-selector.module';
import { NoteModule } from '../note/note.module';
import { ProjectSelectorModule } from '../project-selector/project-selector.module';
import { TaskSelectorModule } from '../task-selector/task-selector.module';
import { TeamSelectorService } from '../team-selector/+state/team-selector.service';
import { TeamSelectorModule } from '../team-selector/team-selector.module';
import { TimeTrackerFormComponent } from './time-tracker-form.component';

@NgModule({
	declarations: [TimeTrackerFormComponent],
	exports: [TimeTrackerFormComponent],
	imports: [
		CommonModule,
		TeamSelectorModule,
		TaskSelectorModule,
		ProjectSelectorModule,
		ClientSelectorModule,
		NoteModule
	],
	providers: [TimeTrackerStore, TimeTrackerQuery, TeamSelectorService]
})
export class TimeTrackerFormModule {}
