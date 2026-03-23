import { Component, ElementRef, OnInit, Renderer2, ViewChild } from '@angular/core';
import { IIntegrationViewModel, IntegrationFilterEnum } from '@gauzy/contracts';
import { InitialFilter, IntegrationsStoreService } from '@gauzy/ui-core/core';
import { Observable } from 'rxjs';

@Component({
	selector: 'ngx-integrations',
	templateUrl: './integrations.component.html',
	styleUrls: ['./integrations.component.scss'],
	standalone: false
})
export class IntegrationsComponent implements OnInit {
	integrations$: Observable<IIntegrationViewModel[]> = this._integrationsStore.integrations$;
	integrationGroups$: Observable<any[]> = this._integrationsStore.integrationGroups$;
	selectedIntegrationTypeId$: Observable<string> = this._integrationsStore.selectedIntegrationTypeId$;
	selectedIntegrationFilter$: Observable<string> = this._integrationsStore.selectedIntegrationFilter$;
	isLoading$: Observable<boolean> = this._integrationsStore.isLoading$;

	@ViewChild('searchElement', { static: false }) readonly searchElement: ElementRef;

	public filters = [
		{ label: IntegrationFilterEnum.ALL, value: 'all' },
		{ label: IntegrationFilterEnum.FREE, value: 'false' },
		{ label: IntegrationFilterEnum.PAID, value: 'true' }
	];

	constructor(
		private readonly _integrationsStore: IntegrationsStoreService,
		private readonly renderer: Renderer2
	) {}

	ngOnInit() {
		// Initialization handled by IntegrationsStoreService
	}

	setSelectedIntegrationType(integrationTypeId: string): void {
		this._integrationsStore.setSelectedIntegrationTypeId(integrationTypeId);
	}

	setSelectedIntegrationFilter(filter: string): void {
		this._integrationsStore.setSelectedIntegrationFilter(filter);
	}

	doSearch(event: Event): void {
		const target = event.target as HTMLInputElement;
		this._integrationsStore.searchIntegration(target.value);
	}

	clearFilter(): void {
		this._integrationsStore.clearFilters();
		if (this.searchElement?.nativeElement) {
			this.renderer.setProperty(this.searchElement.nativeElement, 'value', InitialFilter.searchQuery);
		}
	}
}
