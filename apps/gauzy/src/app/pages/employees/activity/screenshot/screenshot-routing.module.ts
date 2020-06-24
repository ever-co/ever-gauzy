import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ScreenshotComponent } from './screenshot/screenshot.component';

const routes: Routes = [
	{
		path: '',
		component: ScreenshotComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ScreenshotRoutingModule {}
