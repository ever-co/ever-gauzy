import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { OrganizationsService } from '@gauzy/ui-core/core';
import { RoleService } from '@gauzy/ui-core/core';
import { StarRatingOutputComponent } from './star-rating-output.component';

@NgModule({
	imports: [CommonModule, NbIconModule],
	exports: [StarRatingOutputComponent],
	declarations: [StarRatingOutputComponent],
	providers: [OrganizationsService, RoleService]
})
export class StarRatingOutputModule {}
