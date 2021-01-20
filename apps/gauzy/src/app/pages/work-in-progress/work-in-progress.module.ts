import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module'; // deepscan-disable-line
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { WorkInProgressComponent } from './work-in-progress.component';
import { WorkInProgressRoutingModule } from './work-in-progress-routing.module';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		WorkInProgressRoutingModule,
		ThemeModule,
		NbCardModule,
		NbIconModule,
		TranslaterModule
	],
	declarations: [WorkInProgressComponent]
})
export class WorkInProgressModule {}
