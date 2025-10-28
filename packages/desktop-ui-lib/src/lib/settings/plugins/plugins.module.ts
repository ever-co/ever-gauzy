import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonGroupModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInfiniteListDirective,
	NbInputModule,
	NbListModule,
	NbRadioModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbStepperModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule,
	NbUserModule
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
import { PluginSettingsEffects } from './component/plugin-marketplace/+state/effects/plugin-settings.effects';
import { PluginSourceEffects } from './component/plugin-marketplace/+state/effects/plugin-source.effect';
import { PluginSubscriptionEffects } from './component/plugin-marketplace/+state/effects/plugin-subscription.effect';
import { PluginUserAssignmentEffects } from './component/plugin-marketplace/+state/effects/plugin-user-assignment.effects';
import { PluginVersionEffects } from './component/plugin-marketplace/+state/effects/plugin-version.effect';
import { PluginSubscriptionFacade } from './component/plugin-marketplace/+state/plugin-subscription.facade';
import { PluginSettingsQuery } from './component/plugin-marketplace/+state/queries/plugin-settings.query';
import { PluginSubscriptionQuery } from './component/plugin-marketplace/+state/queries/plugin-subscription.query';
import { PluginSettingsStore } from './component/plugin-marketplace/+state/stores/plugin-settings.store';
import { PluginSubscriptionStore } from './component/plugin-marketplace/+state/stores/plugin-subscription.store';
import { PluginMarketplaceDetailComponent } from './component/plugin-marketplace/plugin-marketplace-detail/plugin-marketplace-detail.component';
import { PluginMarketplaceFilterComponent } from './component/plugin-marketplace/plugin-marketplace-filter/plugin-marketplace-filter.component';
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
import { PluginSettingsManagementComponent } from './component/plugin-marketplace/plugin-settings-management/plugin-settings-management.component';
import { PluginSettingsManagerComponent } from './component/plugin-marketplace/plugin-settings-manager/plugin-settings-manager.component';
import { PluginSubscriptionManagerComponent } from './component/plugin-marketplace/plugin-subscription-manager/plugin-subscription-manager.component';
import { PluginSubscriptionPlanCreatorComponent } from './component/plugin-marketplace/plugin-subscription-plan-creator/plugin-subscription-plan-creator.component';
import { PluginSubscriptionSelectionComponent } from './component/plugin-marketplace/plugin-subscription-selection/plugin-subscription-selection.component';
import { PluginTagsManagerComponent } from './component/plugin-marketplace/plugin-tags-manager/plugin-tags-manager.component';
import { PluginUserManagementComponent } from './component/plugin-marketplace/plugin-user-management/plugin-user-management.component';
import { PluginComponent } from './component/plugin/plugin.component';
import { PluginAnalyticsService } from './services/plugin-analytics.service';
import { PluginElectronService } from './services/plugin-electron.service';
import { PluginLoaderService } from './services/plugin-loader.service';
import { PluginSecurityService } from './services/plugin-security.service';
import { PluginSettingsService } from './services/plugin-settings.service';
import { PluginSubscriptionService } from './services/plugin-subscription.service';
import { PluginTagsService } from './services/plugin-tags.service';
import { PluginUserAssignmentService } from './services/plugin-user-assignment.service';
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
		PluginMarketplaceFilterComponent,
		PluginSettingsManagerComponent,
		PluginSettingsManagementComponent,
		PluginSubscriptionManagerComponent,
		PluginSubscriptionSelectionComponent,
		PluginTagsManagerComponent,
		PluginUserManagementComponent,
		PluginMarketplaceUploadComponent,
		PluginMarketplaceItemComponent,
		PluginVersionComponent,
		PluginSourceComponent,
		PluginMetadataComponent,
		PluginBasicInformationComponent,
		PluginSubscriptionPlanCreatorComponent,
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
		NbButtonGroupModule,
		NbDialogModule,
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
		NbCheckboxModule,
		NbContextMenuModule,
		NbTabsetModule,
		NbUserModule,
		NbRadioModule,
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
		PluginSubscriptionService,
		PluginTagsService,
		PluginSettingsService,
		PluginAnalyticsService,
		PluginSecurityService,
		PluginUserAssignmentService,
		provideEffectsManager(),
		provideEffects(
			PluginEffects,
			PluginInstallationEffects,
			PluginMarketplaceEffects,
			PluginVersionEffects,
			PluginSourceEffects,
			PluginUserAssignmentEffects,
			PluginSettingsEffects,
			PluginSubscriptionEffects
		),
		PluginQuery,
		PluginStore,
		PluginSettingsQuery,
		PluginSettingsStore,
		PluginSubscriptionQuery,
		PluginSubscriptionStore,
		PluginSubscriptionFacade,
		NbInfiniteListDirective
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PluginsModule {}
