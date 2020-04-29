import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { RoleService } from '../../../@core/services/role.service';
import { StarRatingInputComponent } from './star-rating-input.component';

@NgModule({
	imports: [ThemeModule, NbIconModule],
	exports: [StarRatingInputComponent],
	declarations: [StarRatingInputComponent],
	entryComponents: [StarRatingInputComponent],
	providers: [OrganizationsService, RoleService]
})
export class StarRatingInputModule {}
