import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationTeamsService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	EmployeeMultiSelectModule,
	ImageUploaderModule,
	ProjectSelectModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { TeamsRoutingModule } from './teams-routing.module';
import { TeamsComponent } from './teams.component';
import { TeamsMutationComponent } from './teams-mutation/teams-mutation.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
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
		NbTooltipModule,
		TeamsRoutingModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		EmployeeMultiSelectModule,
		ProjectSelectModule,
		SmartDataViewLayoutModule,
		ImageUploaderModule
	],
	declarations: [TeamsComponent, TeamsMutationComponent],
	providers: [OrganizationTeamsService]
})
export class TeamsModule {}
