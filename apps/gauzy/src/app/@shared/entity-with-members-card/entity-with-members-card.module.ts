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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { EntityWithMembersCardComponent } from './entity-with-members-card.component';
import { TableComponentsModule } from '../table-components/table-components.module';

@NgModule({
	imports: [
		TableComponentsModule,
		NbBadgeModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbTooltipModule,
		NbToastrModule.forRoot(),
		TranslateModule
	],
	declarations: [EntityWithMembersCardComponent],
	exports: [EntityWithMembersCardComponent],
	providers: []
})
export class EntityWithMembersModule {}
