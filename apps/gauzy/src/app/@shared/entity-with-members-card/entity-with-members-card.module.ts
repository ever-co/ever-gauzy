import { HttpClient } from '@angular/common/http';
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
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [EntityWithMembersCardComponent],
	entryComponents: [EntityWithMembersCardComponent],
	exports: [EntityWithMembersCardComponent],
	providers: []
})
export class EntityWithMembersModule {}
