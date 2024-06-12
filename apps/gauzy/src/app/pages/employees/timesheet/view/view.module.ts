// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule, EditTimeLogModalModule, GauzyButtonActionModule, SharedModule } from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
		SharedModule,
		MomentModule,
		DialogsModule,
		EditTimeLogModalModule,
		NbCheckboxModule,
		GauzyButtonActionModule
	]
})
export class ViewModule {}
