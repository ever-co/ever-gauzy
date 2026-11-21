import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbDialogModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	EquipmentMutationModule,
	SharedModule,
	TableComponentsModule,
	UserFormsModule,
	FavoriteToggleModule,
	RecordViewModule
} from '@gauzy/ui-core/shared';
import { EquipmentRoutingModule } from './equipment-routing.module';
import { EquipmentComponent } from './equipment.component';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
import { EquipmentViewPageComponent } from './equipment-view/equipment-view-page.component';
// The equipment page draws its charts with the expense page's: the same bars, line and ring.
import { ExpenseBarChartComponent } from '../expenses/expense-view/expense-charts/expense-bar-chart.component';
import { ExpenseShareChartComponent } from '../expenses/expense-view/expense-charts/expense-share-chart.component';

@NgModule({
	imports: [
		RecordViewModule,
		FavoriteToggleModule,
		EquipmentRoutingModule,
		SharedModule,
		UserFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		NbIconModule,
		NbDialogModule.forChild(),
		EquipmentMutationModule,
		TableComponentsModule,
		CardGridModule,
		TranslatePipe,
		NbSpinnerModule,
		NbSelectModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		SmartDataViewLayoutModule,
		ExpenseBarChartComponent,
		ExpenseShareChartComponent
	],
	declarations: [EquipmentComponent, AutoApproveComponent, EquipmentViewPageComponent]
})
export class EquipmentModule {}
