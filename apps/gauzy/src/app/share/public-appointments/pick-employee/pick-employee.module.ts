import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { EventTypeService } from '@gauzy/ui-core/core';
import { SelectorsModule, SharedModule } from '@gauzy/ui-core/shared';
import { PickEmployeeComponent } from './pick-employee.component';
import { PickEmployeeRoutingModule } from './pick-employee.routing.module';

@NgModule({
	imports: [
		NbToastrModule,
		NbSpinnerModule,
		NbButtonModule,
		NbCardModule,
		TranslateModule.forChild(),
		PickEmployeeRoutingModule,
		SharedModule,
		SelectorsModule
	],
	declarations: [PickEmployeeComponent],
	providers: [EventTypeService]
})
export class PickEmployeeModule {}
