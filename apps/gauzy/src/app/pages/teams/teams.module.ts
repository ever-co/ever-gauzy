import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationTeamsService } from '@gauzy/ui-sdk/core';
import {
	EmployeeMultiSelectModule,
	GauzyButtonActionModule,
	ImageUploaderModule,
	PaginationV2Module,
	ProjectSelectModule,
	SharedModule,
	TableComponentsModule,
	TagsColorInputModule
} from '@gauzy/ui-sdk/shared';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
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
		CardGridModule,
		NbTooltipModule,
		Angular2SmartTableModule,
		TeamsRoutingModule,
		NbDialogModule.forChild(),
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		EmployeeMultiSelectModule,
		ProjectSelectModule,
		PaginationV2Module,
		GauzyButtonActionModule,
		ImageUploaderModule
	],
	declarations: [TeamsComponent, TeamsMutationComponent],
	providers: [OrganizationTeamsService]
})
export class TeamsModule {}
