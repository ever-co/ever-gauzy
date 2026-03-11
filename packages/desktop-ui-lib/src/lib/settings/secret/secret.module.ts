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
import { SecretComponent } from './secret.component';
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
		SecretComponent,
	],
	providers: [],
	exports: [SecretComponent]
})
export class SecretModule { }
