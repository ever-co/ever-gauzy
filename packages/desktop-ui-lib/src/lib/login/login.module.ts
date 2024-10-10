import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbAuthModule } from '@nebular/auth';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule
} from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { LanguageModule } from '../language/language.module';
import { SwitchThemeModule } from '../theme-selector/switch-theme/switch-theme.module';
import { NgxLoginComponent } from './login.component';
import { LogoComponent } from './shared/ui/logo/logo.component';
import { SocialLinksComponent } from './shared/ui/social-links/social-links.component';

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
		SwitchThemeModule
	],
	declarations: [NgxLoginComponent, SocialLinksComponent, LogoComponent],
	exports: [NgxLoginComponent]
})
export class NgxLoginModule {}
