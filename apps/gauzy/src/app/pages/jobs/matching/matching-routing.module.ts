import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MatchingComponent } from './matching/matching.component';

const routes: Routes = [
	{
		path: '',
		component: MatchingComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class MatchingRoutingModule {}
