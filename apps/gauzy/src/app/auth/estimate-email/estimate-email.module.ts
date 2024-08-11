import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { EstimateEmailService, InvoicesService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { EstimateEmailComponent } from './estimate-email.component';

@NgModule({
	imports: [CommonModule, NbCardModule, NbSpinnerModule, TranslateModule.forChild()],
	providers: [InvoicesService, EstimateEmailService],
	declarations: [EstimateEmailComponent]
})
export class EstimateEmailModule {}
