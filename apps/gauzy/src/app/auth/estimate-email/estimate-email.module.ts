import { NgModule } from '@angular/core';
import { EstimateEmailComponent } from './estimate-email.component';
import { InvoicesService } from '../../@core/services/invoices.service';
import { CommonModule } from '@angular/common';
import { EstimateEmailService } from '../../@core/services/estimate-email.service';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [CommonModule, NbCardModule, NbSpinnerModule, TranslateModule],
	providers: [InvoicesService, EstimateEmailService],
	entryComponents: [EstimateEmailComponent],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
