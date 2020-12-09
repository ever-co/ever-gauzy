import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbActionsModule,
	NbBadgeModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { VendorsComponent } from './vendors.component';
import { OrganizationVendorsService } from '../../@core/services/organization-vendors.service';
import { VendorsRoutingModule } from './vendors-routing.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { SharedModule } from '../../@shared/shared.module';
@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		TagsColorInputModule,
		NbActionsModule,
		TableComponentsModule,
		VendorsRoutingModule,
		NbBadgeModule,
		CardGridModule,
		NbDialogModule,
		SharedModule,
		Ng2SmartTableModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [VendorsComponent],
	entryComponents: [],
	providers: [OrganizationVendorsService]
})
export class VendorsModule {}
