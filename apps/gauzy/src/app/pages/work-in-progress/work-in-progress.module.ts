import { NgModule } from '@angular/core';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { ThemeModule } from '../../@theme/theme.module';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';

@NgModule({
	imports: [WorkInProgressRoutingModule, ThemeModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
