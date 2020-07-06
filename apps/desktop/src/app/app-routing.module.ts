import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import { SetupComponent } from './pages/setup/setup.component';
import { TimeTrackerComponent } from './pages/time-tracker/time-tracker.component';

const routes: Routes = [
	{
		path: '',
		component: SetupComponent
	},
	{
		path: 'time-tracker',
		component: TimeTrackerComponent
	}
];

const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(routes, config)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
