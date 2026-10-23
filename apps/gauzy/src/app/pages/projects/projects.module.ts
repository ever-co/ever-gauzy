import { NgModule } from '@angular/core';
import {
	NbActionsModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EntityWithMembersModule,
	FavoriteToggleModule,
	ProjectMutationModule,
	ProjectModuleMutationModule,
	RecordViewModule
} from '@gauzy/ui-core/shared';
// Record-side Documents panel (spec 00 §6.14 R-LNK-02). Standalone, so it is
// imported directly — the Documents hub module is never pulled in here.
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';
import { ProjectsRoutingModule } from './projects-routing.module';
import { TableComponentsModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectListComponent } from './components/project-list/list.component';
import { ProjectQuickLookComponent } from './components/project-quick-look/project-quick-look.component';
import { ProjectViewPageComponent } from './components/project-view/project-view-page.component';
import { ProjectBoardComponent } from './components/project-view/project-board/project-board.component';
import { ProjectActivityComponent } from './components/project-view/project-activity/project-activity.component';
import { TaskViewHeaderComponent } from '../tasks/components/task-view/task-view-header.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		NgxPermissionsModule.forChild(),
		ProjectsRoutingModule,
		TableComponentsModule,
		EntityWithMembersModule,
		SharedModule,
		SmartDataViewLayoutModule,
		CardGridModule,
		FavoriteToggleModule,
		ProjectMutationModule,
		ProjectModuleMutationModule,
		DocumentLinksPanelComponent,
		// The project page's shell (back button, heading, not-found / no-access states).
		RecordViewModule,
		// The project page's body. Standalone, shared with the team and employee pages' drawers.
		ProjectQuickLookComponent,
		// The project page's other tabs. Standalone, used only by the project page.
		ProjectBoardComponent,
		ProjectActivityComponent,
		// The task drawer's issue-style header, shared with the task lists. Standalone.
		TaskViewHeaderComponent
	],
	declarations: [
		ProjectLayoutComponent,
		ProjectListComponent,
		ProjectCreateMutationComponent,
		ProjectEditMutationComponent,
		ProjectViewPageComponent
	],
	providers: []
})
export class ProjectsModule {}
