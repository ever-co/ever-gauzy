import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TenantService } from '../../@core/services/tenant.service';
import { OrganizationsStepFormModule } from '../../@shared/organizations/organizations-step-form/organizations-step-form.module';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { TenantDetailsRoutingModule } from './tenant-details-routing.module';
import { TenantDetailsComponent } from './tenant-details.component';
import { TagsService } from '../../@core/services/tags.service';

@NgModule({
	imports: [
		TenantDetailsRoutingModule,
		ThemeModule,
		NbSpinnerModule,
		OrganizationsStepFormModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [TenantService, TagsService],
	declarations: [TenantDetailsComponent]
})
export class TenantDetailsModule {}
