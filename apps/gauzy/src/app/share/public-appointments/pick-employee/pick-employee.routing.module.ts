import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PickEmployeeComponent } from './pick-employee.component';
const routes: Routes = [
	{
		path: '',
		component: PickEmployeeComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PickEmployeeRoutingModule {}
