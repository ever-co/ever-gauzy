import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { TaskComponent } from './components/task/task.component';
import { TaskSettingsComponent } from './components/task/task-settings/task-settings.component';

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
