import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { AlertModule } from '../../dialogs/alert/alert.module';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';
import { NoDataMessageModule } from '../../time-tracker/no-data-message/no-data-message.module';
import { PaginationModule } from '../../time-tracker/pagination/pagination.module';
import { AddPluginComponent } from './component/add-plugin/add-plugin.component';
import { PluginLayoutComponent } from './component/plugin-layout/plugin-layout.component';
import { PluginListComponent } from './component/plugin-list/plugin-list.component';
import { PluginStatusComponent } from './component/plugin-list/plugin-status/plugin-status.component';
import { PluginUpdateComponent } from './component/plugin-list/plugin-update/plugin-update.component';
import { PluginMarketplaceDetailComponent } from './component/plugin-marketplace/plugin-marketplace-detail/plugin-marketplace-detail.component';
import { PluginMarketplaceComponent } from './component/plugin-marketplace/plugin-marketplace.component';
import { PluginComponent } from './component/plugin/plugin.component';
import { PluginElectronService } from './services/plugin-electron.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginService } from './services/plugin.service';
import { PluginMarketplaceUploadComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-marketplace-upload.component';

@NgModule({
	declarations: [
		AddPluginComponent,
		PluginListComponent,
		PluginComponent,
		PluginLayoutComponent,
		PluginStatusComponent,
		PluginUpdateComponent,
		PluginMarketplaceComponent,
		PluginMarketplaceDetailComponent,
		PluginMarketplaceUploadComponent
	],
	imports: [
		CommonModule,
		Angular2SmartTableModule,
		PaginationModule,
		NbButtonModule,
		NbInputModule,
		NbCardModule,
		DesktopDirectiveModule,
		NoDataMessageModule,
		NbIconModule,
		TranslateModule,
		RouterModule,
		NbBadgeModule,
		FormsModule,
		NbToggleModule,
		ReactiveFormsModule,
		NbRouteTabsetModule,
		AlertModule,
		NbFormFieldModule,
		NbSelectModule
	],
	exports: [PluginLayoutComponent],
	providers: [PluginLoaderService, PluginElectronService, PluginService]
})
export class PluginsModule {}
