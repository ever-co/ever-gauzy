import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbProgressBarModule, NbTooltipModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ActivityItemComponent } from './activity-item.component';
import { SharedModule } from '../../../shared.module';

@NgModule({
	declarations: [ActivityItemComponent],
	exports: [ActivityItemComponent],
	imports: [
		CommonModule,
		MomentModule,
		NbButtonModule,
		NbIconModule,
		NbProgressBarModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		SharedModule
	]
})
export class ActivityItemModule {}
