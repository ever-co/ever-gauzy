import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, ProductMutationModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ProductTypesComponent } from './product-types.component';
import { ProductTypesRoutingModule } from './product-types-routing.module';

@NgModule({
	declarations: [ProductTypesComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		ProductTypesRoutingModule,
		SharedModule,
		ProductMutationModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	]
})
export class ProductTypesModule {}
