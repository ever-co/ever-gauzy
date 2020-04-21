import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { WorkspaceComponent } from './workspace/workspace.component';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [...Pipes, WorkspaceComponent],
	imports: [CommonModule, BackNavigationModule, RouterModule],
	exports: [BackNavigationModule, WorkspaceComponent, ...Pipes]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
