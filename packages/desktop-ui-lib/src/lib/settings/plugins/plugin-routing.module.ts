import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				loadComponent: () => import('./component/plugin-layout/plugin-layout.component').then((m) => m.PluginLayoutComponent),
				loadChildren: () => import('./plugin.route').then((m) => m.routes)
			}
		])
	],
	exports: [RouterModule]
})
export class PluginRoutingModule {}
