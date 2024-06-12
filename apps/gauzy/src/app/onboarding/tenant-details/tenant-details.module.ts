import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TagsService, TenantService } from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsStepFormModule } from '@gauzy/ui-sdk/shared';
import { TenantDetailsRoutingModule } from './tenant-details-routing.module';
import { TenantDetailsComponent } from './tenant-details.component';
import { ThemeSelectorModule } from '../../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';

@NgModule({
	imports: [
		CommonModule,
		NbSpinnerModule,
		TenantDetailsRoutingModule,
		OrganizationsStepFormModule,
		I18nTranslateModule.forChild(),
		ThemeSelectorModule
	],
	providers: [TenantService, TagsService],
	declarations: [TenantDetailsComponent]
})
export class TenantDetailsModule {}
