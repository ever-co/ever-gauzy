import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbFormFieldModule,
	NbIconModule,
	NbInfiniteListDirective,
	NbInputModule,
	NbListModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbStepperModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { provideEffects, provideEffectsManager } from '@ngneat/effects-ng';
import { TranslateModule } from '@ngx-translate/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { AlertModule } from '../../dialogs/alert/alert.module';
import { DesktopDirectiveModule } from '../../directives/desktop-directive.module';
import { SelectModule } from '../../shared/components/ui/select/select.module';
import { NoDataMessageModule } from '../../time-tracker/no-data-message/no-data-message.module';
import { PaginationModule } from '../../time-tracker/pagination/pagination.module';
import { PipeModule } from '../../time-tracker/pipes/pipe.module';
import { PluginEffects } from './component/+state/plugin.effect';
import { PluginQuery } from './component/+state/plugin.query';
import { PluginStore } from './component/+state/plugin.store';
import { AddPluginComponent } from './component/add-plugin/add-plugin.component';
import { PluginLayoutComponent } from './component/plugin-layout/plugin-layout.component';
import { PluginListComponent } from './component/plugin-list/plugin-list.component';
import { PluginStatusComponent } from './component/plugin-list/plugin-status/plugin-status.component';
import { PluginUpdateComponent } from './component/plugin-list/plugin-update/plugin-update.component';
import { PluginInstallationEffects } from './component/plugin-marketplace/+state/effects/plugin-installation.effect';
import { PluginMarketplaceEffects } from './component/plugin-marketplace/+state/effects/plugin-marketplace.effect';
import { PluginSourceEffects } from './component/plugin-marketplace/+state/effects/plugin-source.effect';
import { PluginVersionEffects } from './component/plugin-marketplace/+state/effects/plugin-version.effect';
import { PluginMarketplaceDetailComponent } from './component/plugin-marketplace/plugin-marketplace-detail/plugin-marketplace-detail.component';
import { DialogCreateSourceComponent } from './component/plugin-marketplace/plugin-marketplace-item/dialog-create-source/dialog-create-source.component';
import { DialogCreateVersionComponent } from './component/plugin-marketplace/plugin-marketplace-item/dialog-create-version/dialog-create-version.component';
import { DialogInstallationValidationComponent } from './component/plugin-marketplace/plugin-marketplace-item/dialog-installation-validation/dialog-installation-validation.component';
import { PluginMarketplaceItemComponent } from './component/plugin-marketplace/plugin-marketplace-item/plugin-marketplace-item.component';
import { SourceSelectorComponent } from './component/plugin-marketplace/plugin-marketplace-item/source-selector/source-selector.component';
import { VersionHistoryComponent } from './component/plugin-marketplace/plugin-marketplace-item/version-history/version-history.component';
import { VersionSelectorComponent } from './component/plugin-marketplace/plugin-marketplace-item/version-selector/version-selector.component';
import { FileUploadComponent } from './component/plugin-marketplace/plugin-marketplace-upload/file-upload/file-upload.component';
import { FormRowComponent } from './component/plugin-marketplace/plugin-marketplace-upload/form-row/form-row.component';
import { FormSectionComponent } from './component/plugin-marketplace/plugin-marketplace-upload/form-section/form-section.component';
import { PluginBasicInformationComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-basic-information/plugin-basic-information.component';
import { PluginMarketplaceUploadComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-marketplace-upload.component';
import { PluginMetadataComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-metadata/plugin-metadata.component';
import { CdnFormComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-source/forms/cdn-form/cdn-form.component';
import { GauzyFormComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-source/forms/gauzy-form/gauzy-form.component';
import { NpmFormComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-source/forms/npm-form/npm-form.component';
import { PluginSourceComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-source/plugin-source.component';
import { PluginVersionComponent } from './component/plugin-marketplace/plugin-marketplace-upload/plugin-version/plugin-version.component';
import { PluginMarketplaceComponent } from './component/plugin-marketplace/plugin-marketplace.component';
import { PluginComponent } from './component/plugin/plugin.component';
import { PluginElectronService } from './services/plugin-electron.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginService } from './services/plugin.service';
import { SourceContainerComponent } from './shared/ui/source-container/source-container.component';

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
		PluginMarketplaceUploadComponent,
		PluginMarketplaceItemComponent,
		PluginVersionComponent,
		PluginSourceComponent,
		PluginMetadataComponent,
		PluginBasicInformationComponent,
		FormSectionComponent,
		FormRowComponent,
		FileUploadComponent,
		DialogCreateVersionComponent,
		VersionHistoryComponent,
		VersionSelectorComponent,
		SourceSelectorComponent,
		DialogInstallationValidationComponent,
		CdnFormComponent,
		GauzyFormComponent,
		NpmFormComponent,
		DialogCreateSourceComponent,
		SourceContainerComponent
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
		NbSelectModule,
		NbTooltipModule,
		NbSpinnerModule,
		NbDatepickerModule,
		NbStepperModule,
		NbAlertModule,
		PipeModule,
		NbListModule,
		SelectModule,
		NbEvaIconsModule,
		DragDropModule
	],
	exports: [PluginLayoutComponent],
	providers: [
		PluginLoaderService,
		PluginElectronService,
		PluginService,
		provideEffectsManager(),
		provideEffects(
			PluginEffects,
			PluginInstallationEffects,
			PluginMarketplaceEffects,
			PluginVersionEffects,
			PluginSourceEffects
		),
		PluginQuery,
		PluginStore,
		NbInfiniteListDirective
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PluginsModule {}
