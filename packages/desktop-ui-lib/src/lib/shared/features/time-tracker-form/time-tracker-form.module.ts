import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { PipeModule } from '../../../time-tracker/pipes/pipe.module';
import { SelectModule } from '../../components/ui/select/select.module';
import { TextAreaModule } from '../../components/ui/text-area/text-area.module';
import { ClientSelectorModule } from '../client-selector/client-selector.module';
import { NoteSelectorStore } from '../note/+state/note-selector.store';
import { ProjectSelectorModule } from '../project-selector/project-selector.module';
import { TaskSelectorModule } from '../task-selector/task-selector.module';
import { TeamSelectorModule } from '../team-selector/team-selector.module';
import { TimeTrackerFormComponent } from './time-tracker-form.component';

@NgModule({
	declarations: [TimeTrackerFormComponent],
	exports: [TimeTrackerFormComponent],
	imports: [
		CommonModule,
		SelectModule,
		TextAreaModule,
		TeamSelectorModule,
		TaskSelectorModule,
		ProjectSelectorModule,
		NoteSelectorStore,
		ClientSelectorModule,
		NbButtonModule,
		NbIconModule,
		PipeModule
	]
})
export class TimeTrackerFormModule {}
