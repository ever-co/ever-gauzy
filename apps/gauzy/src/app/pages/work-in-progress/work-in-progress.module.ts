import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';

@NgModule({
	imports: [WorkInProgressRoutingModule, NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
