import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { IntegrationResolver, PermissionsGuard } from '@gauzy/ui-core/core';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectResolver } from './project.resolver';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectListComponent } from './components/project-list/list.component';
import { ProjectManagerOrPermissionGuard } from './guards/project-manager-or-permission.guard';

const routes: Routes = [
	{
		path: '',
		component: ProjectLayoutComponent,
		children: [
			{
				path: '',
				component: ProjectListComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW],
						redirectTo: '/pages/dashboard'
					}
				}
			},
			{
				path: 'create',
				component: ProjectCreateMutationComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD],
						redirectTo: '/pages/dashboard'
					},
					selectors: {
						project: false,
						team: false,
						employee: false,
						organization: false
					}
				}
			},
			{
				path: ':id',
				data: {
					allowMissingIntegration: true,
					integration: IntegrationEnum.GITHUB, // Custom data associated with this route
					relations: ['integration'],
					selectors: {
						project: false,
						team: false,
						employee: false,
						organization: false
					}
				},
				resolve: {
					project: ProjectResolver,
					integration: IntegrationResolver || null
				},

				children: [
					{
						path: 'edit',
						component: ProjectEditMutationComponent,
						canActivate: [ProjectManagerOrPermissionGuard],
						data: {
							permissions: {
								only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT],
								redirectTo: '/pages/dashboard'
							},
							relations: [
								'organizationContact',
								'organization',
								'members.employee.user',
								'tags',
								'teams',
								'customFields.repository'
							]
						}
					}
				]
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProjectsRoutingModule {}
