import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ConfirmEmailComponent } from './confirm-email.component';

@NgModule({
	imports: [CommonModule, TranslateModule.forChild(), NbSpinnerModule],
	declarations: [ConfirmEmailComponent],
	providers: []
})
export class ConfirmEmailModule {}
