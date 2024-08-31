import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbCardModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';
import { NoDataMessageModule } from '../../time-tracker/no-data-message/no-data-message.module';
import { PaginationModule } from '../../time-tracker/pagination/pagination.module';
import { AddPluginComponent } from './component/add-plugin/add-plugin.component';
import { PluginLayoutComponent } from './component/plugin-layout/plugin-layout.component';
import { PluginListComponent } from './component/plugin-list/plugin-list.component';
import { PluginStatusComponent } from './component/plugin-list/plugin-status/plugin-status.component';
import { PluginUpdateComponent } from './component/plugin-list/plugin-update/plugin-update.component';
import { PluginComponent } from './component/plugin/plugin.component';
import { PluginElectronService } from './services/plugin-electron.service';
import { PluginLoaderService } from './services/plugin-loader.service';

@NgModule({
	declarations: [
		AddPluginComponent,
		PluginListComponent,
		PluginComponent,
		PluginLayoutComponent,
		PluginStatusComponent,
		PluginUpdateComponent
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
		FormsModule
	],
	exports: [PluginLayoutComponent],
	providers: [PluginLoaderService, PluginElectronService]
})
export class PluginsModule {}
