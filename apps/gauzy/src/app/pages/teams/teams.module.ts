import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbSpinnerModule,
	NbSelectModule,
	NbBadgeModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { OrganizationTeamsService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EmployeeMultiSelectModule,
	FavoriteToggleModule,
	ImageUploaderModule,
	ProjectSelectModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule,
	RecordViewModule
} from '@gauzy/ui-core/shared';
import { TeamsRoutingModule } from './teams-routing.module';
import { TeamsComponent } from './teams.component';
import { TeamsMutationComponent } from './teams-mutation/teams-mutation.component';
import { ViewTeamComponent } from './view-team/view-team.component';
import { TaskViewHeaderComponent } from '../tasks/components/task-view/task-view-header.component';
import { EmployeeHoursChartComponent } from '../employees/view-employee/employee-hours-chart/employee-hours-chart.component';

@NgModule({
	imports: [
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		NbActionsModule,
		TableComponentsModule,
		NbSpinnerModule,
		NbSelectModule,
		NbBadgeModule,
		SharedModule,
		CardGridModule,
		FavoriteToggleModule,
		NbTooltipModule,
		TeamsRoutingModule,
		NbDialogModule.forChild(),
		TranslatePipe,
		NgxPermissionsModule.forChild(),
		EmployeeMultiSelectModule,
		ProjectSelectModule,
		SmartDataViewLayoutModule,
		ImageUploaderModule,
		RecordViewModule,
		EmployeeHoursChartComponent,
		TaskViewHeaderComponent
	],
	declarations: [TeamsComponent, TeamsMutationComponent, ViewTeamComponent],
	providers: [OrganizationTeamsService]
})
export class TeamsModule {}
