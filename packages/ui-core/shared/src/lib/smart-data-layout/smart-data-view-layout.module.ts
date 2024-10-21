import { NgModule } from '@angular/core';
import { NbIconModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../shared.module';
import { GauzyButtonActionModule } from '../gauzy-button-action/gauzy-button-action.module';
import { NoDataMessageModule } from './no-data-message/no-data-message.module';
import { PaginationComponent } from './pagination/pagination.component';
import { PaginationV2Component } from './pagination/pagination-v2/pagination-v2.component';

// Components
const COMPONENTS = [PaginationComponent, PaginationV2Component];

@NgModule({
	declarations: [...COMPONENTS],
	imports: [
		NbToggleModule,
		NbIconModule,
		NbSelectModule,
		TranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		Angular2SmartTableModule,
		SharedModule,
		GauzyButtonActionModule,
		NoDataMessageModule
	],
	exports: [Angular2SmartTableModule, GauzyButtonActionModule, NoDataMessageModule, ...COMPONENTS],
	providers: []
})
export class SmartDataViewLayoutModule {}
