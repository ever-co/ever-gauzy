import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	ProductMutationModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';

@NgModule({
	declarations: [ProductTypesComponent],
	imports: [
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		ProductTypesRoutingModule,
		SharedModule,
		CardGridModule,
		ProductMutationModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	]
})
export class ProductTypesModule {}
