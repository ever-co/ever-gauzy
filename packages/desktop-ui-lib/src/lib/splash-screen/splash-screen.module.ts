import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplashScreenComponent } from './splash-screen.component';
import { NbLayoutModule, NbCardModule, NbSpinnerModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { NgxTranslateModule } from '../ngx-translate';
import { LanguageSelectorService } from '../language/language-selector.service';

@NgModule({
	declarations: [SplashScreenComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbSpinnerModule,
		NbButtonModule,
		DesktopDirectiveModule,
		NbIconModule,
		NgxTranslateModule
	],
	exports: [SplashScreenComponent],
	providers: [LanguageSelectorService]
})
export class SplashScreenModule {}
