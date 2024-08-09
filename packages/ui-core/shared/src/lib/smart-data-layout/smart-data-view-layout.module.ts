import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { SharedModule } from '../shared.module';
import { GauzyButtonActionModule } from '../gauzy-button-action/gauzy-button-action.module';
import { NoDataMessageModule } from './components/no-data-message/no-data-message.module';
import { PaginationComponent } from './components/pagination/pagination.component';
import { PaginationV2Component } from './components/pagination/pagination-v2/pagination-v2.component';
import { SmartTableToggleComponent } from './components/smart-table-toggle/smart-table-toggle.component';
import { CardGridComponent } from './components/card-grid/card-grid.component';
import { CustomViewComponent } from './components/card-grid/card-grid-custom.component';

// Components
const COMPONENTS = [PaginationComponent, PaginationV2Component, SmartTableToggleComponent, CardGridComponent];

@NgModule({
	declarations: [...COMPONENTS, CustomViewComponent],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbToggleModule,
		NbSelectModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		InfiniteScrollModule,
		SharedModule,
		Angular2SmartTableModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	exports: [Angular2SmartTableModule, GauzyButtonActionModule, NoDataMessageModule, ...COMPONENTS],
	providers: []
})
export class SmartDataViewLayoutModule {}
