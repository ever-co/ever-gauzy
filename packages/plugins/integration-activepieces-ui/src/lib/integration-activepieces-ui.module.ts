import { NgModule } from '@angular/core';
// Angular core modules
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
	NbActionsModule,
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCalendarKitModule,
	NbCardModule,
	NbCheckboxModule,
	NbContextMenuModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import {
	SmartDataViewLayoutModule,
	SelectorsModule,
	SharedModule,
	TableComponentsModule,
	getBrowserLanguage
} from '@gauzy/ui-core/shared';
import { IntegrationActivepiecesRoutes } from './integration-activepieces.routes';
import { ActivepiecesAuthorizeComponent } from './components/activepieces-authorize/activepieces-authorize.component';
import { IntegrationActivepiecesLayoutComponent } from './integration-activepieces.layout.component';
import { ActivepiecesComponent } from './components/activepieces/activepieces.component';
import { ActivepiecesCallbackComponent } from './components/activepieces-callback/activepieces-callback.component';
import { ActivepiecesConnectionsComponent } from './components/activepieces-connections/activepieces-connections.component';
import { ActivepiecesMcpServersComponent } from './components/activepieces-mcp-servers/activepieces-mcp-servers.component';

@NgModule({
	declarations: [
		IntegrationActivepiecesLayoutComponent,
		ActivepiecesComponent,
		ActivepiecesAuthorizeComponent,
		ActivepiecesCallbackComponent,
		ActivepiecesConnectionsComponent,
		ActivepiecesMcpServersComponent
	],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbActionsModule,
		NbAlertModule,
		NbBadgeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCalendarKitModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbTabsetModule,
		NbToggleModule,
		NbTooltipModule,
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(),
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		IntegrationActivepiecesRoutes,
		SmartDataViewLayoutModule,
		SelectorsModule,
		SharedModule,
		TableComponentsModule
	]
})
export class IntegrationActivepiecesUiModule {}
