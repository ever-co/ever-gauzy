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
import { CustomSmtpService } from '../../@core/services/custom-smtp.service';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
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
