import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { PickEmployeeComponent } from './pick-employee.component';
import { PickEmployeeRoutingModule } from './pick-employee.routing.module';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';
import { BackNavigationModule } from '../../../@shared/back-navigation/back-navigation.module';
import { EventTypeService } from '../../../@core/services/event-type.service';

@NgModule({
	imports: [
		ThemeModule,
		NbToastrModule,
		NbSpinnerModule,
		NbButtonModule,
		NbCardModule,
		EmployeeSelectorsModule,
		BackNavigationModule,
		PickEmployeeRoutingModule,
		I18nTranslateModule.forChild()
	],
	declarations: [PickEmployeeComponent],
	providers: [EventTypeService]
})
export class PickEmployeeModule {}
