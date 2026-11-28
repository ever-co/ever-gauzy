import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
	NbCardModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	OrganizationContactService,
	PaymentService
} from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	SharedModule,
	TableFiltersModule,
	FavoriteToggleModule,
	RecordViewModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { PaymentsComponent } from './payments.component';
import { PaymentsRoutingModule } from './payments-routing.module';
import { PaymentViewPageComponent } from './payment-view/payment-view-page.component';
import { ExpenseBarChartComponent } from '../expenses/expense-view/expense-charts/expense-bar-chart.component';
import { ExpenseShareChartComponent } from '../expenses/expense-view/expense-charts/expense-share-chart.component';

@NgModule({
	imports: [
		RecordViewModule,
		FavoriteToggleModule,
		TranslatePipe,
		NbCardModule,
		PaymentsRoutingModule,
		CardGridModule,
		SharedModule,
		NbIconModule,
		NbSpinnerModule,
		NbSelectModule,
		NbButtonModule,
		NbTooltipModule,
		RouterModule,
		// The page's amounts, drawn as the grid draws them
		TableComponentsModule,
		NbDialogModule.forChild(),
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		TableFiltersModule,
		// The page's charts, the expense page's own
		ExpenseBarChartComponent,
		ExpenseShareChartComponent
	],
	providers: [PaymentService, OrganizationContactService, InvoicesService, InvoiceEstimateHistoryService],
	declarations: [PaymentsComponent, PaymentViewPageComponent]
})
export class PaymentsModule {}
