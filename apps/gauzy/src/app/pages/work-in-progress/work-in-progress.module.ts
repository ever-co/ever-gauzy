import { NgModule } from '@angular/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';

@NgModule({
	imports: [WorkInProgressRoutingModule, NbCardModule, NbIconModule, I18nTranslateModule.forChild()],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
