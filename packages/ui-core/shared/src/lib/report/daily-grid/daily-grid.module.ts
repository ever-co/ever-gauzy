import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbAccordionModule,
	NbBadgeModule,
	NbCardModule,
	NbIconModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { DailyGridComponent } from './daily-grid.component';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { NoDataMessageModule } from '../../smart-data-layout/no-data-message/no-data-message.module';

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
		NbTooltipModule,
		TranslatePipe,
		SharedModule,
		ProjectColumnViewModule,
		TableComponentsModule,
		NoDataMessageModule
	],
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent]
})
export class DailyGridModule {}
