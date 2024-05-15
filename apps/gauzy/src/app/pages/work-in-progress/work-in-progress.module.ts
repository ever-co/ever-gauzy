import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module'; // deepscan-disable-line
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [WorkInProgressRoutingModule, ThemeModule, NbCardModule, NbIconModule, TranslateModule],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
