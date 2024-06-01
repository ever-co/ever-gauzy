import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyGridComponent } from './daily-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule,
	NbAccordionModule,
	NbBadgeModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { TableComponentsModule } from '../../table-components';
import { NoDataMessageModule } from '../../no-data-message/no-data-message.module';

@NgModule({
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule.forChild(),
		NbAccordionModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		FormsModule,
		ProjectColumnViewModule,
		NbBadgeModule,
		TableComponentsModule,
		NoDataMessageModule
	]
})
export class DailyGridModule {}
