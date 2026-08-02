import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { PipesModule } from '../pipes/pipes.module';
import { StatusBadgeModule } from '../status-badge/status-badge.module';
import { TableComponentsModule } from '../table-components/table-components.module';
import { RecordViewComponent } from './record-view.component';
import { RecordViewDrawerComponent } from './record-view-drawer.component';

/**
 * The shared read-only "View" surface: a descriptor-driven record renderer plus
 * the right-side drawer that hosts it for the simpler records.
 *
 * `TableComponentsModule` is imported for the tag / people / team / amount
 * renderers — a record must read the same in its View as in the grid row it was
 * selected from.
 */
@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		PipesModule,
		StatusBadgeModule,
		TableComponentsModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild()
	],
	declarations: [RecordViewComponent, RecordViewDrawerComponent],
	exports: [RecordViewComponent, RecordViewDrawerComponent]
})
export class RecordViewModule {}
