import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ActivepiecesAuthorizeComponent } from './components/activepieces-authorize/activepieces-authorize.component';
import { IntegrationActivepiecesLayoutComponent } from './integration-activepieces.layout.component';
import { ActivepiecesComponent } from './components/activepieces/activepieces.component';
import { ActivepiecesCallbackComponent } from './components/activepieces-callback/activepieces-callback.component';
import { ActivepiecesConnectionsComponent } from './components/activepieces-connections/activepieces-connections.component';
import { ActivepiecesMcpServersComponent } from './components/activepieces-mcp-servers/activepieces-mcp-servers.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationActivepiecesLayoutComponent,
				children: [
					{
						path: '',
						component: ActivepiecesAuthorizeComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: ActivepiecesAuthorizeComponent,
						data: { state: false }
					},
					{
						path: 'callback',
						component: ActivepiecesCallbackComponent
					},
					{
						path: ':id',
						component: ActivepiecesComponent,
						children: [
							{
								path: '',
								redirectTo: 'connections',
								pathMatch: 'full'
							},
							{
								path: 'connections',
								component: ActivepiecesConnectionsComponent
							},
							{
								path: 'mcp-servers',
								component: ActivepiecesMcpServersComponent
							}
						]
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationActivepiecesRoutes {}
