import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbSpinnerModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TenantService } from '../../@core/services/tenant.service';
import { OrganizationsStepFormModule } from '../../@shared/organizations/organizations-step-form/organizations-step-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { TenantDetailsRoutingModule } from './tenant-details-routing.module';
import { TenantDetailsComponent } from './tenant-details.component';
import { TagsService } from '../../@core/services/tags.service';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, '../../assets/i18n/', '.json');
}

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
