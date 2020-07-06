import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app/app.component';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';
import { NbSpinnerModule, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [AppComponent],
	imports: [
		CommonModule,
		AppRoutingModule,
		FiltersModule,
		NbSpinnerModule,
		NbProgressBarModule,
		TranslateModule
	]
})
export class AppModule {}
