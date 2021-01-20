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
import { ThemeModule } from '../../@theme/theme.module';
import { EntityWithMembersCardComponent } from './entity-with-members-card.component';
import { TableComponentsModule } from '../table-components/table-components.module';
import { TranslaterModule } from '../translater/translater.module';

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
		TranslaterModule
	],
	declarations: [EntityWithMembersCardComponent],
	entryComponents: [EntityWithMembersCardComponent],
	exports: [EntityWithMembersCardComponent],
	providers: []
})
export class EntityWithMembersModule {}
