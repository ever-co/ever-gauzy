import { NgModule } from '@angular/core';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { CommonModule } from '@angular/common';
import { TimeTrackerComponent } from './time-tracker.component';
import { TimeTrackerService } from './time-tracker.service';
import { CustomRenderComponent } from './custom-render-cell.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbToggleModule,
	NbSelectModule,
	NbInputModule,
	NbButtonModule,
	NbSpinnerModule,
	NbIconModule,
	NbSidebarModule,
	NbSidebarService,
	NbCheckboxModule,
	NbDialogService,
	NbDialogModule,
	NbToastrService,
	NbFormFieldModule,
	NbTooltipModule,
	NbBadgeModule
} from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TasksModule } from '../tasks/tasks.module';
import { PaginationModule } from './pagination/pagination.module';
import { NoDataMessageComponent } from './no-data-message/no-data-message.component';
import { HumanizePipe } from './pipes/humanize.pipe';
import { UserOrganizationService } from './organization-selector/user-organization.service';
import { OrganizationSelectorComponent } from './organization-selector/organization-selector.component';

@NgModule({
	declarations: [
		TimeTrackerComponent,
		CustomRenderComponent,
		NoDataMessageComponent,
		HumanizePipe,
		OrganizationSelectorComponent
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
		Ng2SmartTableModule,
		NbTooltipModule,
		TasksModule,
		NbToggleModule,
		NbBadgeModule,
		PaginationModule,
		NbTooltipModule
	],
	providers: [NbSidebarService, TimeTrackerService, NbDialogService, NbToastrService, UserOrganizationService],
	exports: [TimeTrackerComponent]
})
export class TimeTrackerModule {}
