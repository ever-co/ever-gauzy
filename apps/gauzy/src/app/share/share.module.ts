import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule,
	NbUserModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	ImageUploaderModule,
	MiscellaneousModule,
	SharedModule,
	TableComponentsModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { PublicLayoutModule } from '@gauzy/plugin-public-layout-ui';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbMenuModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTagModule,
	NbToastrModule.forRoot(),
	NbUserModule
];

@NgModule({
	imports: [
		...NB_MODULES,
		TranslateModule.forChild(),
		ShareRoutingModule,
		MiscellaneousModule,
		ThemeModule,
		SharedModule,
		TableComponentsModule,
		WorkInProgressModule,
		ImageUploaderModule,
		PublicLayoutModule
	],
	declarations: [ShareComponent],
	providers: []
})
export class ShareModule {}
