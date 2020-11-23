import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SMTPComponent } from './smtp.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { CustomSmtpService } from '../../@core/services/custom-smtp.service';
import { ThemeModule } from '../../@theme/theme.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		ReactiveFormsModule,
		ThemeModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [SMTPComponent],
	declarations: [SMTPComponent],
	providers: [CustomSmtpService]
})
export class SMTPModule {}
