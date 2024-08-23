import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { TimezoneSelectorComponent } from './timezone-selector.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NgSelectModule,
		TranslateModule.forChild()
	],
	exports: [TimezoneSelectorComponent],
	declarations: [TimezoneSelectorComponent],
	providers: []
})
export class TimezoneSelectorModule {}
