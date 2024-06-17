import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TagsService, TenantService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { OrganizationsStepFormModule } from '@gauzy/ui-core/shared';
import { ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { TenantDetailsRoutingModule } from './tenant-details-routing.module';
import { TenantDetailsComponent } from './tenant-details.component';

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
