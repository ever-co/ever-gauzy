import { Component, OnInit } from '@angular/core';
import { IntegrationsService } from 'apps/gauzy/src/app/@core/services/integrations.service';
import { IIntegrationViewModel } from '@gauzy/models';

@Component({
	selector: 'ngx-integrations-list',
	templateUrl: './integrations-list.component.html',
	styleUrls: ['./integrations-list.component.scss']
})
export class IntegrationsListComponent implements OnInit {
	integrations: IIntegrationViewModel[] = this._integrationsService
		.integrations;

	constructor(private _integrationsService: IntegrationsService) {}

	ngOnInit() {}
}
