import { NgModule } from '@angular/core';
import { NbIconModule, NbSelectModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SharedModule } from '../shared.module';
import { GauzyButtonActionModule } from '../gauzy-button-action/gauzy-button-action.module';
import { PaginationComponent } from './pagination/pagination.component';
import { PaginationV2Component } from './pagination/pagination-v2/pagination-v2.component';
import { SmartTableToggleComponent } from './smart-table-toggle/smart-table-toggle.component';

// Nebular Modules
const NB_MODULES = [NbToggleModule, NbIconModule, NbSelectModule];

// Third Party Modules
const THIRD_PARTY_MODULES = [TranslateModule.forChild(), NgxPermissionsModule.forChild()];

@NgModule({
	imports: [...NB_MODULES, ...THIRD_PARTY_MODULES, SharedModule, Angular2SmartTableModule, GauzyButtonActionModule],
	declarations: [PaginationComponent, PaginationV2Component, SmartTableToggleComponent],
	exports: [
		Angular2SmartTableModule,
		GauzyButtonActionModule,
		PaginationComponent,
		PaginationV2Component,
		SmartTableToggleComponent
	],
	providers: []
})
export class AngularSmartTableModule {}
