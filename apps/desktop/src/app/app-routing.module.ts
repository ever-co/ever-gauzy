import { RouterModule, Routes, ExtraOptions } from '@angular/router';
import { NgModule } from '@angular/core';
import { SetupComponent } from './pages/setup/setup.component';
import { TimeTrackerComponent } from './pages/time-tracker/time-tracker.component';
import { ScreenCaptureComponent } from './pages/screen-capture/screen-capture.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { UpdaterComponent } from './pages/updater/updater.component';
import { ImageViewerComponent } from './pages/image-viewer/image-viewer.component';

const routes: Routes = [
	{
		path: '',
		component: SetupComponent
	},
	{
		path: 'time-tracker',
		component: TimeTrackerComponent
	},
	{
		path: 'screen-capture',
		component: ScreenCaptureComponent
	},
	{
		path: 'settings',
		component: SettingsComponent
	},
	{
		path: 'updater',
		component: UpdaterComponent
	},
	{
		path: 'viewer',
		component: ImageViewerComponent
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
