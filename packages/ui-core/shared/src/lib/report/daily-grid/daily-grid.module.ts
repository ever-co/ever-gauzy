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
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { DailyGridComponent } from './daily-grid.component';
import { ProjectColumnViewModule } from '../project-column-view/project-column-view.module';
import { SmartDataViewLayoutModule } from '../../smart-data-layout/smart-data-view-layout.module';

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
		TranslateModule.forChild(),
		SharedModule,
		ProjectColumnViewModule,
		TableComponentsModule,
		SmartDataViewLayoutModule
	],
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent]
})
export class DailyGridModule {}
