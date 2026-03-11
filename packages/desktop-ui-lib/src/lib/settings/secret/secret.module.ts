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
import { SecretComponet } from './secret.component';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageModule } from '../../language/language.module';

@NgModule({
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
		SecretComponet
	],
	providers: [],
	exports: [SecretComponet]
})
export class SecretModule { }
