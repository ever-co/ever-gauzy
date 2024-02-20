import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbMenuModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbToggleModule,
	NbInputModule,
	NbButtonModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { SslComponent } from './ssl.component';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageModule } from '../../language/language.module';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';

@NgModule({
	declarations: [SslComponent],
	imports: [
		CommonModule,
		NbMenuModule.forRoot(),
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		FormsModule,
		NbToggleModule,
		NbInputModule,
		NbButtonModule,
		NbTooltipModule,
		NbSpinnerModule,
		LanguageModule,
		TranslateModule,
		DesktopDirectiveModule
	],
	providers: [],
	exports: [SslComponent]
})
export class SslModule {}
