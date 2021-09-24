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
import { TranslateModule } from '../translate/translate.module';
import { SharedModule } from '../shared.module';

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
		TranslateModule,
		SharedModule
	],
	exports: [SMTPComponent],
	declarations: [SMTPComponent],
	providers: [CustomSmtpService]
})
export class SMTPModule {}
