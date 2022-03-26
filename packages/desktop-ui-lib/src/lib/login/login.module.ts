import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbAuthModule } from '@nebular/auth';
import {
	TranslateLoader,
	TranslateModule as NgxTranslateModule
} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
  	NbFormFieldModule
} from '@nebular/theme';
import { HttpClient } from '@angular/common/http';
import { NgxLoginComponent } from './login.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		NgxTranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [NgxLoginComponent],
	exports: [NgxLoginComponent]
})
export class NgxLoginModule {}
