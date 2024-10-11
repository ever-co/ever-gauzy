import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbListModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { AvatarModule } from '../shared/components/ui/avatar/avatar.module';
import { SwitchThemeModule } from '../theme-selector/switch-theme/switch-theme.module';
import { NgxLoginMagicComponent } from './features/login-magic/login-magic.component';
import { NgxLoginWorkspaceComponent } from './features/login-workspace/login-workspace.component';
import { NgxMagicSignInWorkspaceComponent } from './features/magic-login-workspace/magic-login-workspace.component';
import { NgxLoginComponent } from './login.component';
import { LogoComponent } from './shared/ui/logo/logo.component';
import { SocialLinksComponent } from './shared/ui/social-links/social-links.component';
import { WorkspaceSelectionComponent } from './shared/ui/workspace-selection/workspace-selection.component';

const shared = [
	NgxLoginComponent,
	NgxLoginMagicComponent,
	NgxMagicSignInWorkspaceComponent,
	NgxLoginWorkspaceComponent
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		RouterModule,
		NbAlertModule,
		NbAuthModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbFormFieldModule,
		DesktopDirectiveModule,
		LanguageModule.forChild(),
		ReactiveFormsModule,
		SwitchThemeModule,
		NbListModule,
		AvatarModule
	],
	declarations: [LogoComponent, SocialLinksComponent, WorkspaceSelectionComponent, ...shared],
	exports: [shared]
})
export class NgxLoginModule {}
