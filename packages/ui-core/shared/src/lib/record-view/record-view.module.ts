import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { PipesModule } from '../pipes/pipes.module';
import { StatusBadgeModule } from '../status-badge/status-badge.module';
import { TableComponentsModule } from '../table-components/table-components.module';
import { RecordViewComponent } from './record-view.component';
import { RecordViewDrawerComponent } from './record-view-drawer.component';
import { RecordViewPageComponent } from './record-view-page.component';
import { RecordViewRoutePageComponent } from './record-view-route-page.component';
import { FavoriteToggleModule } from '../favorite-toggle/favorite-toggle.module';

/**
 * The shared read-only "View" surface: a descriptor-driven record renderer, the
 * right-side drawer that hosts it for a quick look, and the full-width page
 * that hosts it on a record's own route.
 *
 * `TableComponentsModule` is imported for the tag / people / team / amount
 * renderers — a record must read the same in its View as in the grid row it was
 * selected from.
 */
@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		RouterModule,
		PipesModule,
		StatusBadgeModule,
		TableComponentsModule,
		TranslatePipe,
		FavoriteToggleModule,
		NgxPermissionsModule.forChild()
	],
	declarations: [
		RecordViewComponent,
		RecordViewDrawerComponent,
		RecordViewPageComponent,
		RecordViewRoutePageComponent
	],
	exports: [RecordViewComponent, RecordViewDrawerComponent, RecordViewPageComponent, RecordViewRoutePageComponent]
})
export class RecordViewModule {}
