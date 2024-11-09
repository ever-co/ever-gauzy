import { NgModule } from '@angular/core';
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
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EntityWithMembersModule,
	ProjectMutationModule,
	AddProjectModuleDialogModule
} from '@gauzy/ui-core/shared';
import { ProjectsRoutingModule } from './projects-routing.module';
import { TableComponentsModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectListComponent } from './components/project-list/list.component';

@NgModule({
	imports: [
		NbActionsModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		ProjectsRoutingModule,
		TableComponentsModule,
		EntityWithMembersModule,
		SharedModule,
		SmartDataViewLayoutModule,
		CardGridModule,
		ProjectMutationModule,
		AddProjectModuleDialogModule,
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
