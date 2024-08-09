import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { TagsService, TenantService } from '@gauzy/ui-core/core';
import { OrganizationsStepFormModule } from '@gauzy/ui-core/shared';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { TenantDetailsRoutingModule } from './tenant-onboarding-routing.module';
import { TenantOnboardingComponent } from './tenant-onboarding.component';

@NgModule({
	imports: [
		CommonModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		ThemeModule,
		TenantDetailsRoutingModule,
		OrganizationsStepFormModule,
		ThemeSelectorModule
	],
	providers: [TenantService, TagsService],
	declarations: [TenantOnboardingComponent]
})
export class TenantOnboardingModule {}
