import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { MyTaskComponent } from './components/my-task/my-task.component';

const routes: Routes = [
	{
		path: '',
		component: MyTaskComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class MyTasksRoutingModule {}
