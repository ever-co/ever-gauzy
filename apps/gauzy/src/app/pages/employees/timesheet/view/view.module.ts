// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ViewRoutingModule } from './view-routing.module';
import { ViewComponent } from './view/view.component';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { MomentModule } from 'ngx-moment';

@NgModule({
	declarations: [ViewComponent],
	imports: [
		CommonModule,
		ViewRoutingModule,
		NbCardModule,
		TranslateModule,
		SharedModule,
		NbButtonModule,
		MomentModule,
		NbIconModule
	]
})
export class ViewModule {}
