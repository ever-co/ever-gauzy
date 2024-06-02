import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbProgressBarModule, NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { ActivityItemComponent } from './activity-item.component';
import { SharedModule } from '../../../shared.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [ActivityItemComponent],
	exports: [ActivityItemComponent],
	imports: [
		CommonModule,
		SharedModule,
		NbIconModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		NbProgressBarModule,
		MomentModule,
		NbButtonModule
	]
})
export class ActivityItemModule {}
