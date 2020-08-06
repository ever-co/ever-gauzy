import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NbIconModule, NbProgressBarModule } from '@nebular/theme';
import { ActivityItemComponent } from './activity-item.component';
import { SharedModule } from '../../../shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [ActivityItemComponent],
	exports: [ActivityItemComponent],
	imports: [
		CommonModule,
		SharedModule,
		NbIconModule,
		TranslateModule,
		NbProgressBarModule,
		MomentModule
	]
})
export class ActivityItemModule {}
