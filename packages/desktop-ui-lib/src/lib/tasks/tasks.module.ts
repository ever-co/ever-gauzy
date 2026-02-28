import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbAccordionModule,
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbListModule,
	NbMenuModule,
	NbProgressBarModule,
	NbSelectModule,
	NbSidebarModule,
	NbTabsetModule,
	NbToastrService,
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { CKEditorModule } from 'ckeditor4-angular';
import { TagService } from '../services';
import { ClientSelectorModule } from '../shared/features/client-selector/client-selector.module';
import { ProjectSelectorModule } from '../shared/features/project-selector/project-selector.module';
import { TaskSelectorModule } from '../shared/features/task-selector/task-selector.module';
import { TeamSelectorModule } from '../shared/features/team-selector/team-selector.module';
import { TaskRenderModule } from '../time-tracker/task-render';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbSidebarModule,
		NbMenuModule.forRoot(),
		NbCardModule,
		NbIconModule,
		NbListModule,
		NbSelectModule,
		FormsModule,
		NbToggleModule,
		NbInputModule,
		NbButtonModule,
		NbAlertModule,
		NbProgressBarModule,
		NbTabsetModule,
		NbAccordionModule,
		NbDatepickerModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbBadgeModule,
		TranslateModule,
		CKEditorModule,
		TaskRenderModule,
		ClientSelectorModule,
		TaskSelectorModule,
		TeamSelectorModule,
		ProjectSelectorModule
	],
	providers: [NbToastrService, TimeTrackerService, TagService]
})
export class TasksModule {}
