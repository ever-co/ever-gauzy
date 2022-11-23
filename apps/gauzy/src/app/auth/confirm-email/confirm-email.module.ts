import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmEmailComponent } from './confirm-email.component';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule
	],
	providers: [],
	declarations: [ConfirmEmailComponent]
})
export class ConfirmEmailModule {}
