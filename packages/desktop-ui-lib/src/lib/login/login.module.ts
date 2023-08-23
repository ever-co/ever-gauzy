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
	NbIconModule,
	NbInputModule,
  	NbFormFieldModule
} from '@nebular/theme';
import { NgxLoginComponent } from './login.component';
import { DesktopDirectiveModule } from '../directives/desktop-directive.module';
import { NgxTranslateModule } from '../ngx-translate';
import { LanguageSelectorService } from '../language/language-selector.service';

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
		NgxTranslateModule
	],
	declarations: [NgxLoginComponent],
	exports: [NgxLoginComponent],
	providers: [LanguageSelectorService]
})
export class NgxLoginModule {}
