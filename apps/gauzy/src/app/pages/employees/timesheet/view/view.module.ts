// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { MomentModule } from 'ngx-moment';
import { DialogsModule, EditTimeLogModalModule, GauzyButtonActionModule, SharedModule } from '@gauzy/ui-core/shared';
import { ViewRoutingModule } from './view-routing.module';
import { GithubViewComponent } from './view/view.component';

@NgModule({
	declarations: [GithubViewComponent],
	imports: [
		CommonModule,
		ViewRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild(),
		SharedModule,
		MomentModule,
		DialogsModule,
		EditTimeLogModalModule,
		NbCheckboxModule,
		GauzyButtonActionModule
	]
})
export class ViewModule {}
