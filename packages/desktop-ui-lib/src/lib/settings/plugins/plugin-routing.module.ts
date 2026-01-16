import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PluginLayoutComponent } from './component/plugin-layout/plugin-layout.component';
import { routes } from './plugin.route';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: PluginLayoutComponent,
				children: routes
			}
		])
	],
	exports: [RouterModule]
})
export class PluginRoutingModule {}
