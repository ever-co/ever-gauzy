import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TimeOffComponent } from './time-off.component';
import { TimeOffSettingsComponent } from './time-off-settings/time-off-settings.component';

const routes: Routes = [
	{
		path: '',
		component: TimeOffComponent
	},
	{
		path: 'settings',
		component: TimeOffSettingsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TimeOffRoutingModule {}
