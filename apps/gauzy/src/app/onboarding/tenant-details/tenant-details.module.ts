import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { TenantService } from '../../@core/services/tenant.service';
import { OrganizationsStepFormModule } from '../../@shared/organizations/organizations-step-form/organizations-step-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { TenantDetailsRoutingModule } from './tenant-details-routing.module';
import { TenantDetailsComponent } from './tenant-details.component';
import { TagsService } from '../../@core/services/tags.service';
import { TranslaterModule } from '../../@shared/translater/translater.module';

@NgModule({
	imports: [
		TenantDetailsRoutingModule,
		ThemeModule,
		NbSpinnerModule,
		OrganizationsStepFormModule,
		TranslaterModule
	],
	providers: [TenantService, TagsService],
	declarations: [TenantDetailsComponent]
})
export class TenantDetailsModule {}
