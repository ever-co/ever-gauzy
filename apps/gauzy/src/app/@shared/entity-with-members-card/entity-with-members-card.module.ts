import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbToastrModule,
	NbTooltipModule,
	NbBadgeModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { EntityWithMembersCardComponent } from './entity-with-members-card.component';

@NgModule({
	imports: [
		NbBadgeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		NbToastrModule.forRoot(),
		I18nTranslateModule.forChild(),
		TableComponentsModule
	],
	declarations: [EntityWithMembersCardComponent],
	exports: [EntityWithMembersCardComponent],
	providers: []
})
export class EntityWithMembersModule {}
