import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { RoleService } from '../../../@core/services/role.service';
import { StarRatingInputComponent } from './star-rating-input.component';

@NgModule({
	imports: [ThemeModule, NbIconModule],
	exports: [StarRatingInputComponent],
	declarations: [StarRatingInputComponent],
	providers: [OrganizationsService, RoleService]
})
export class StarRatingInputModule {}
