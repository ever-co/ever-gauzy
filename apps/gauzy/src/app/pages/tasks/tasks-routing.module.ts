import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { TaskComponent } from './components/task/task.component';

const routes: Routes = [
	{
		path: '',
		component: TaskComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TasksRoutingModule {}
