import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { TaskComponent } from './components/task/task.component';
import { TaskSettingsComponent } from './components/task/task-settings/task-settings.component';
import { TaskViewPageComponent } from './components/task-view/task-view-page.component';

const routes: Routes = [
	{
		path: '',
		children: [
			{
				path: '',
				redirectTo: 'dashboard',
				pathMatch: 'full'
			},
			{
				path: 'dashboard',
				component: TaskComponent
			},
			{
				path: 'team',
				component: TaskComponent
			},
			{
				path: 'me',
				component: TaskComponent
			},
			{
				// One task, full width, at a URL of its own: what a task favorite opens and where the task
				// drawer's "expand to full width" icon leads (handover §4.P).
				path: 'view/:id',
				component: TaskViewPageComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
						redirectTo: '/pages/tasks/dashboard'
					},
					selectors: { project: false, team: false, employee: false, date: false }
				}
			},
			{
				path: 'settings/:id',
				component: TaskSettingsComponent,
				canActivate: [PermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT],
						redirectTo: '/pages/tasks/dashboard'
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TasksRoutingModule {}
