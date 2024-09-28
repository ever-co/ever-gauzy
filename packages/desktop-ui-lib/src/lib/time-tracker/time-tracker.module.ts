import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbEvaIconsModule } from '@nebular/eva-icons';
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
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { ElectronService, LoggerService } from '../electron/services';
import { ImageViewerModule } from '../image-viewer/image-viewer.module';
import { ActivityWatchModule } from '../integrations';
import { LanguageModule } from '../language/language.module';
import { TimeSlotQueueService } from '../offline-sync';
import { ErrorHandlerService, NativeNotificationService, Store, ToastrNotificationService } from '../services';
import { SelectModule } from '../shared/components/ui/select/select.module';
import { ClientSelectorModule } from '../shared/features/client-selector/client-selector.module';
import { NoteModule } from '../shared/features/note/note.module';
import { TaskSelectorModule } from '../shared/features/task-selector/task-selector.module';
import { TeamSelectorModule } from '../shared/features/team-selector/team-selector.module';
import { TimeTrackerFormModule } from '../shared/features/time-tracker-form/time-tracker-form.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectSelectorModule } from './../shared/features/project-selector/project-selector.module';
import { CustomRenderComponent } from './custom-render-cell.component';
import { NoDataMessageModule } from './no-data-message/no-data-message.module';
import { OrganizationSelectorComponent } from './organization-selector/organization-selector.component';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { PaginationModule } from './pagination/pagination.module';
import { PipeModule } from './pipes/pipe.module';
import { TaskRenderModule } from './task-render/task-render.module';
import { TimeTrackerStatusModule } from './time-tracker-status/time-tracker-status.module';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import { TimerTrackerChangeDialogComponent } from './timer-tracker-change-dialog/timer-tracker-change-dialog.component';

@NgModule({
	declarations: [
		TimeTrackerComponent,
		CustomRenderComponent,
		OrganizationSelectorComponent,
		TimerTrackerChangeDialogComponent
	],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbToggleModule,
		NbSelectModule,
		NbInputModule,
		NbButtonModule,
		NbSpinnerModule,
		NbIconModule,
		NbEvaIconsModule,
		NbSidebarModule,
		FormsModule,
		NbCheckboxModule,
		ReactiveFormsModule,
		NgSelectModule,
		NbDialogModule,
		NbFormFieldModule,
		Angular2SmartTableModule,
		NbTooltipModule,
		TasksModule,
		NbToggleModule,
		NbBadgeModule,
		PaginationModule,
		NbTooltipModule,
		TimeTrackerStatusModule,
		ImageViewerModule,
		LanguageModule.forChild(),
		TaskRenderModule,
		ActivityWatchModule,
		NoDataMessageModule,
		PipeModule,
		NbTabsetModule,
		TimeTrackerFormModule,
		SelectModule,
		DesktopDirectiveModule,
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
	],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {}
