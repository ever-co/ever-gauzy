import { NgModule } from '@angular/core';
import { NbIconModule } from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { SharedModule } from '../../shared.module';
import { TableComponentsModule } from '../../table-components/table-components.module';
import { RecurringExpenseHistoryComponent } from './recurring-expense-history.component';

@NgModule({
	imports: [
		ThemeModule,
		Angular2SmartTableModule,
		TableComponentsModule,
		NbIconModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	exports: [RecurringExpenseHistoryComponent],
	declarations: [RecurringExpenseHistoryComponent],
	providers: []
})
export class RecurringExpenseHistoryModule {}
