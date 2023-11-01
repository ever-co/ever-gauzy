import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationEnum, PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ProjectLayoutComponent } from './layout/layout.component';
import { ProjectResolver } from './project.resolver';
import { ProjectCreateMutationComponent } from './components/project-create/create.component';
import { ProjectEditMutationComponent } from './components/project-edit/edit.component';
import { ProjectListComponent } from './components/project-list/list.component';
import { IntegrationResolver } from '../integrations/integration.resolver';

const routes: Routes = [
	{
		path: '',
		component: ProjectLayoutComponent,
		children: [
			{
				path: '',
				component: ProjectListComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [
							PermissionsEnum.ALL_ORG_VIEW,
							PermissionsEnum.ORG_PROJECT_VIEW
						],
						redirectTo: '/pages/dashboard'
					}
				}
			},
			{
				path: 'create',
				component: ProjectCreateMutationComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [
							PermissionsEnum.ALL_ORG_EDIT,
							PermissionsEnum.ORG_PROJECT_ADD
						],
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
					integration: IntegrationEnum.GITHUB,
					selectors: {
						project: false,
						team: false,
						employee: false,
						organization: false
					}
				},
				resolve: {
					project: ProjectResolver,
					integration: IntegrationResolver
				},
				children: [
					{
						path: 'edit',
						component: ProjectEditMutationComponent,
						canActivate: [NgxPermissionsGuard],
						data: {
							permissions: {
								only: [
									PermissionsEnum.ALL_ORG_EDIT,
									PermissionsEnum.ORG_PROJECT_EDIT
								],
								redirectTo: '/pages/dashboard'
							},
							relations: [
								'organizationContact',
								'organization',
								'members.user',
								'tags',
								'teams',
								'repository'
							],
						}
					},
				]
			},
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProjectsRoutingModule { }
