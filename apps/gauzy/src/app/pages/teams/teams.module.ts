import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
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
import { FormsModule } from '@angular/forms';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { OrganizationTeamsService } from '../../@core/services/organization-teams.service';
import { TeamsRoutingModule } from './teams-routing.module';
import { TeamsComponent } from './teams.component';
import { TeamsMutationComponent } from './teams-mutation/teams-mutation.component';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		FormsModule,
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
		Ng2SmartTableModule,
		TeamsRoutingModule,
		NbDialogModule.forChild(),
		TranslaterModule
	],
	declarations: [TeamsComponent, TeamsMutationComponent],
	entryComponents: [],
	providers: [OrganizationTeamsService]
})
export class TeamsModule {}
