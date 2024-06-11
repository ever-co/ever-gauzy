import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbAccordionModule,
	NbBadgeModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbSpinnerModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule, TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { DailyGridComponent } from './daily-grid.component';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbAccordionModule,
		NbBadgeModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		ProjectColumnViewModule,
		TableComponentsModule,
		NoDataMessageModule
	],
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent]
})
export class DailyGridModule {}
