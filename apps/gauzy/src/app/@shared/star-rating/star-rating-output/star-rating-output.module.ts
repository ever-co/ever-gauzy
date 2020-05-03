import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { RoleService } from '../../../@core/services/role.service';
import { StarRatingOutputComponent } from './star-rating-output.component';

@NgModule({
	imports: [ThemeModule, NbIconModule],
	exports: [StarRatingOutputComponent],
	declarations: [StarRatingOutputComponent],
	entryComponents: [StarRatingOutputComponent],
	providers: [OrganizationsService, RoleService]
})
export class StarRatingOutputModule {}
