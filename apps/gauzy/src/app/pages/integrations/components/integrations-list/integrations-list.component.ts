import {
	Component,
	ElementRef,
	OnInit,
	Renderer2,
	ViewChild
} from '@angular/core';
import {
	IIntegrationViewModel,
	DEFAULT_INTEGRATION_PAID_FILTERS
} from '@gauzy/contracts';
import {
	InitialFilter,
	IntegrationsStoreService
} from '../../../../@core/services/integrations-store.service';
import { Observable } from 'rxjs';

@Component({
	selector: 'ngx-integrations-list',
	templateUrl: './integrations-list.component.html',
	styleUrls: ['./integrations-list.component.scss']
})
export class IntegrationsListComponent implements OnInit {
	integrations$: Observable<IIntegrationViewModel[]> = this._integrationsStore
		.integrations$;
	integrationGroups$: Observable<any[]> = this._integrationsStore
		.integrationGroups$;
	selectedIntegrationTypeId$: Observable<string> = this._integrationsStore
		.selectedIntegrationTypeId$;
	selectedIntegrationFilter$: Observable<string> = this._integrationsStore
		.selectedIntegrationFilter$;
	isLoading$: Observable<boolean> = this._integrationsStore.isLoading$;

	@ViewChild('searchElement', { static: true }) searchElement: ElementRef;
	filters = DEFAULT_INTEGRATION_PAID_FILTERS;

	constructor(
		private _integrationsStore: IntegrationsStoreService,
		private renderer: Renderer2
	) {}

	ngOnInit() {}

	setSelectedIntegrationType(integrationTypeId) {
		this._integrationsStore.setSelectedIntegrationTypeId(integrationTypeId);
	}

	setSelectedIntegrationFilter(filter: string) {
		this._integrationsStore.setSelectedIntegrationFilter(filter);
	}

	doSearch({ target: { value } }) {
		this._integrationsStore.searchIntegration(value);
	}

	clearFilter() {
		this._integrationsStore.clearFilters();
		this.renderer.setProperty(
			this.searchElement.nativeElement,
			'value',
			InitialFilter.searchQuery
		);
	}
}
