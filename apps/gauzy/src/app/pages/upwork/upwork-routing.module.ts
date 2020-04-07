import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UpworkComponent } from './components/upwork/upwork.component';

const routes: Routes = [
	{
		path: '',
		component: UpworkComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class UpworkRoutingModule {}
