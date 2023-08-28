import {
	Component,
	ElementRef,
	OnInit,
	Renderer2,
	ViewChild
} from '@angular/core';
import { Observable } from 'rxjs';
import {
	IIntegrationViewModel,
	DEFAULT_INTEGRATION_PAID_FILTERS
} from '@gauzy/contracts';
import {
	InitialFilter,
	IntegrationsStoreService
} from '../../@core/services';

@Component({
	selector: 'ngx-integrations',
	templateUrl: './integrations.component.html',
	styleUrls: ['./integrations.component.scss']
})
export class IntegrationsComponent implements OnInit {

	integrations$: Observable<IIntegrationViewModel[]> = this._integrationsStore.integrations$;
	integrationGroups$: Observable<any[]> = this._integrationsStore.integrationGroups$;
	selectedIntegrationTypeId$: Observable<string> = this._integrationsStore.selectedIntegrationTypeId$;
	selectedIntegrationFilter$: Observable<string> = this._integrationsStore.selectedIntegrationFilter$;
	isLoading$: Observable<boolean> = this._integrationsStore.isLoading$;

	@ViewChild('searchElement', { static: true }) searchElement: ElementRef;
	filters = DEFAULT_INTEGRATION_PAID_FILTERS;

	constructor(
		private readonly _integrationsStore: IntegrationsStoreService,
		private readonly renderer: Renderer2
	) { }

	ngOnInit() { }

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
