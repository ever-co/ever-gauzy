import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	CardGridModule,
	EntityWithMembersModule,
	GauzyButtonActionModule,
	PaginationV2Module,
	ProjectMutationModule
} from '@gauzy/ui-sdk/shared';
import { ProjectsRoutingModule } from './projects-routing.module';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
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
		I18nTranslateModule.forChild(),
		ProjectsRoutingModule,
		TableComponentsModule,
		EntityWithMembersModule,
		SharedModule,
		GauzyButtonActionModule,
		PaginationV2Module,
		CardGridModule,
		ProjectMutationModule,
		NgxPermissionsModule.forChild()
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
