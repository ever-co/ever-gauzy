import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { ConfirmEmailComponent } from './confirm-email.component';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule,
		NbSpinnerModule
	],
	providers: [],
	declarations: [ConfirmEmailComponent]
})
export class ConfirmEmailModule {}
