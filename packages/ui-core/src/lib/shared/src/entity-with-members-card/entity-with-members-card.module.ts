import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { TableComponentsModule } from '../table-components/table-components.module';
import { EntityWithMembersCardComponent } from './entity-with-members-card.component';

@NgModule({
	imports: [
		CommonModule,
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
	exports: [EntityWithMembersCardComponent]
})
export class EntityWithMembersModule {}
