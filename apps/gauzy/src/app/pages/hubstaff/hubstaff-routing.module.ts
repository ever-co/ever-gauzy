import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HubstaffAuthorizeComponent } from './components/hubstaff-authorize/hubstaff-authorize.component';
import { HubstaffComponent } from './components/hubstaff/hubstaff.component';

const routes: Routes = [
	{
		path: '',
		component: HubstaffAuthorizeComponent
	},
	{
		path: ':id',
		component: HubstaffComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class HubstaffRoutingModule {}
