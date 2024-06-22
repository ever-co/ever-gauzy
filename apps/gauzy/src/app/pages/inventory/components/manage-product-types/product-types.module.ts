import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	CardGridModule,
	i4netButtonActionModule,
	PaginationV2Module,
	ProductMutationModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
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
		Angular2SmartTableModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		ProductTypesRoutingModule,
		SharedModule,
		CardGridModule,
		ProductMutationModule,
		PaginationV2Module,
		i4netButtonActionModule,
		TableComponentsModule
	]
})
export class ProductTypesModule { }
