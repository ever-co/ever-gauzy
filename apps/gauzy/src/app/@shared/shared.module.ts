import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { WorkspaceComponent } from './workspace/workspace.component';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [...Pipes, ...Components, WorkspaceComponent],
	imports: [CommonModule, BackNavigationModule],
	exports: [BackNavigationModule, ...Pipes, ...Components, RouterModule]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
