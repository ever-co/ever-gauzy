import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { RoleService } from '@gauzy/ui-sdk/core';
import { StarRatingOutputComponent } from './star-rating-output.component';

@NgModule({
	imports: [ThemeModule, NbIconModule],
	exports: [StarRatingOutputComponent],
	declarations: [StarRatingOutputComponent],
	providers: [OrganizationsService, RoleService]
})
export class StarRatingOutputModule {}
