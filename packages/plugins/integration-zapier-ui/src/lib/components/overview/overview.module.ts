import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { OverviewComponent } from './overview.component';

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild([
			{
				path: '',
				component: OverviewComponent
			}
		]),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule
	],
	declarations: [OverviewComponent]
})
export class OverviewModule {}
