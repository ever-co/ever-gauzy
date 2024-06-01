import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { ProjectsRoutingModule } from './projects-routing.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { EntityWithMembersModule } from '../../@shared/entity-with-members-card/entity-with-members-card.module';
import { SharedModule } from '../../@shared/shared.module';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectMutationModule } from '../../@shared/project/project-mutation/project-mutation.module';
import { ProjectListComponent } from './components/project-list/list.component';

@NgModule({
	imports: [
		CommonModule,
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		Angular2SmartTableModule,
		ProjectsRoutingModule,
		ThemeModule,
		TranslateModule.forChild(),
		TableComponentsModule,
		EntityWithMembersModule,
		SharedModule,
		HeaderTitleModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		CardGridModule,
		ProjectMutationModule
	],
	declarations: [
		ProjectLayoutComponent,
		ProjectListComponent,
		ProjectCreateMutationComponent,
		ProjectEditMutationComponent
	],
	providers: []
})
export class ProjectsModule {}
