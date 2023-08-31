import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbLayoutModule, NbListModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { SigninWorksapcesLayoutComponent } from './signin-workspaces.component';
import { SigninWorkspacesLayoutRoutingModule } from './signin-workspaces-routing.module';
import { MultiWorkspaceOnboardingComponent } from './components/multi-workspace/multi-workspace.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbLayoutModule,
		NbListModule,
		NbSpinnerModule,
		ThemeModule,
		SigninWorkspacesLayoutRoutingModule,
	],
	declarations: [
		SigninWorksapcesLayoutComponent,
		MultiWorkspaceOnboardingComponent
	],
	providers: []
})
export class SigninWorkspacesLayoutModule { }
