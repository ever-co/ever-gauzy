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
import { CustomSmtpService } from '../../@core/services/custom-smtp.service';
import { ThemeModule } from '../../@theme/theme.module';
import { TranslaterModule } from '../translater/translater.module';

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
		TranslaterModule
	],
	exports: [SMTPComponent],
	declarations: [SMTPComponent],
	providers: [CustomSmtpService]
})
export class SMTPModule {}
