import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TablerIconsModule } from '@gauzy/ui-core/icons';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDialogModule,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbLayoutModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSidebarModule,
	NbSidebarService,
	NbSpinnerModule,
	NbTabsetModule,
	NbToastrService,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { AlwaysOnService } from '../always-on/always-on.service';
import { ElectronService, LoggerService } from '../electron/services';
import { ImageViewerModule } from '../image-viewer/image-viewer.module';
import { ActivityWatchModule } from '../integrations';
import { LanguageModule } from '../language/language.module';
import { TimeSlotQueueService } from '../offline-sync';
import { ErrorHandlerService, NativeNotificationService, Store, ToastrNotificationService } from '../services';
import { ClientSelectorModule } from '../shared/features/client-selector/client-selector.module';
import { NoteModule } from '../shared/features/note/note.module';
import { TaskSelectorModule } from '../shared/features/task-selector/task-selector.module';
import { TeamSelectorModule } from '../shared/features/team-selector/team-selector.module';
import { TimeTrackerFormModule } from '../shared/features/time-tracker-form/time-tracker-form.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectSelectorModule } from './../shared/features/project-selector/project-selector.module';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { PipeModule } from './pipes/pipe.module';
import { TaskRenderModule } from './task-render/task-render.module';
import { TimeTrackerStatusModule } from './time-tracker-status/time-tracker-status.module';
import { TimeTrackerService } from './time-tracker.service';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		NbSpinnerModule,
		NbIconModule,
		TablerIconsModule,
		NbSidebarModule,
		FormsModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		NgSelectModule,
		NbDialogModule,
		NbFormFieldModule,
		Angular2SmartTableModule,
		TasksModule,
		NbToggleModule,
		NbBadgeModule,
		NbTooltipModule,
		TimeTrackerStatusModule,
		ImageViewerModule,
		LanguageModule.forChild(),
		TaskRenderModule,
		ActivityWatchModule,
		PipeModule,
		NbTabsetModule,
		TimeTrackerFormModule,
		NbRouteTabsetModule,
		ClientSelectorModule,
		TaskSelectorModule,
		TeamSelectorModule,
		ProjectSelectorModule,
		NoteModule
	],
	providers: [
		NbSidebarService,
		TimeTrackerService,
		NbDialogService,
		NbToastrService,
		UserOrganizationService,
		ErrorHandlerService,
		NativeNotificationService,
		ToastrNotificationService,
		ElectronService,
		LoggerService,
		Store,
		TimeSlotQueueService,
		AlwaysOnService
	]
})
export class TimeTrackerModule {}
