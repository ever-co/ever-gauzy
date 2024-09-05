import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { PipeModule } from '../../../time-tracker/pipes/pipe.module';
import { ClientSelectorModule } from '../client-selector/client-selector.module';
import { NoteModule } from '../note/note.module';
import { ProjectSelectorModule } from '../project-selector/project-selector.module';
import { TaskSelectorModule } from '../task-selector/task-selector.module';
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
		NbButtonModule,
		NbIconModule,
		PipeModule,
		NoteModule
	]
})
export class TimeTrackerFormModule {}
