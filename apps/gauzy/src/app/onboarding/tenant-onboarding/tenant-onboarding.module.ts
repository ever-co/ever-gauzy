import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TagsService, TenantService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { OrganizationsStepFormModule } from '@gauzy/ui-core/shared';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { TenantDetailsRoutingModule } from './tenant-onboarding-routing.module';
import { TenantOnboardingComponent } from './tenant-onboarding.component';

@NgModule({
	imports: [
		CommonModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		ThemeModule,
		TenantDetailsRoutingModule,
		OrganizationsStepFormModule,
		ThemeSelectorModule
	],
	providers: [TenantService, TagsService],
	declarations: [TenantOnboardingComponent]
})
export class TenantOnboardingModule {}
