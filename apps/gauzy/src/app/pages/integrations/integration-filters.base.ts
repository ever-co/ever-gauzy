import { ElementRef, Renderer2 } from '@angular/core';
import { IIntegration, IIntegrationGroup, IntegrationFilterEnum } from '@gauzy/contracts';
import { InitialFilter, IntegrationsStoreService } from '@gauzy/ui-core/core';
import { Observable } from 'rxjs';

export abstract class IntegrationFiltersBase {
	protected abstract readonly _integrationsStore: IntegrationsStoreService;

	public get integrations$(): Observable<IIntegration[]> {
		return this._integrationsStore.integrations$;
	}

	public get integrationGroups$(): Observable<IIntegrationGroup[]> {
		return this._integrationsStore.integrationGroups$;
	}

	public get selectedIntegrationTypeId$(): Observable<string> {
		return this._integrationsStore.selectedIntegrationTypeId$;
	}

	public get selectedIntegrationFilter$(): Observable<string> {
		return this._integrationsStore.selectedIntegrationFilter$;
	}

	public get isLoading$(): Observable<boolean> {
		return this._integrationsStore.isLoading$;
	}

	public readonly filters = [
		{ label: IntegrationFilterEnum.ALL, value: 'all' },
		{ label: IntegrationFilterEnum.FREE, value: 'false' },
		{ label: IntegrationFilterEnum.PAID, value: 'true' }
	];

	public doSearch(event: Event): void {
		const query = (event.target as HTMLInputElement | null)?.value ?? InitialFilter.searchQuery;
		this._integrationsStore.searchIntegration(query);
	}

	public setSelectedIntegrationType(integrationTypeId: string): void {
		this._integrationsStore.setSelectedIntegrationTypeId(integrationTypeId);
	}

	public setSelectedIntegrationFilter(filter: string): void {
		this._integrationsStore.setSelectedIntegrationFilter(filter);
	}

	public clearFilter(): void {
		this._integrationsStore.clearFilters();

		const searchInput = this.getSearchInputRef()?.nativeElement;
		if (!searchInput) {
			return;
		}

		const renderer = this.getRenderer();
		if (renderer) {
			renderer.setProperty(searchInput, 'value', InitialFilter.searchQuery);
			return;
		}

		searchInput.value = InitialFilter.searchQuery;
	}

	protected getRenderer(): Renderer2 | undefined {
		return undefined;
	}

	protected abstract getSearchInputRef(): ElementRef<HTMLInputElement> | undefined;
}
