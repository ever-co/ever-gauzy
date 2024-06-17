import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { EstimateEmailService, InvoicesService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { EstimateEmailComponent } from './estimate-email.component';

@NgModule({
	imports: [CommonModule, NbCardModule, NbSpinnerModule, I18nTranslateModule.forChild()],
	providers: [InvoicesService, EstimateEmailService],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
