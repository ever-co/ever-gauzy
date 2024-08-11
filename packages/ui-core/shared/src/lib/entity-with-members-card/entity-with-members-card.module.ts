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
import { TranslateModule } from '@ngx-translate/core';
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
		TranslateModule.forChild(),
		TableComponentsModule
	],
	declarations: [EntityWithMembersCardComponent],
	exports: [EntityWithMembersCardComponent]
})
export class EntityWithMembersModule {}
