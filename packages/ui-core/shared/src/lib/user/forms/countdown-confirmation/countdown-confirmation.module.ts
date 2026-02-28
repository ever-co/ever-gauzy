import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CountdownComponent } from 'ngx-countdown';
import { CountdownConfirmationComponent } from './countdown-confirmation.component';

@NgModule({
	imports: [NbCardModule, NbButtonModule, TranslateModule.forChild(), CountdownComponent],
	declarations: [CountdownConfirmationComponent],
	exports: [CountdownConfirmationComponent]
})
export class CountdownConfirmationModule {}
