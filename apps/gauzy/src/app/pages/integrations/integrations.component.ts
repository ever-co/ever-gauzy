import { Component, ElementRef, OnInit, Renderer2, ViewChild, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
	// Integrations observables
	integrations$: Observable<IIntegrationViewModel[]> = this._integrationsStore.integrations$;
	integrationGroups$: Observable<any[]> = this._integrationsStore.integrationGroups$;
	selectedIntegrationTypeId$: Observable<string> = this._integrationsStore.selectedIntegrationTypeId$;
	selectedIntegrationFilter$: Observable<string> = this._integrationsStore.selectedIntegrationFilter$;
	isLoading$: Observable<boolean> = this._integrationsStore.isLoading$;

	// Tab management using signals
	protected readonly activeTab = signal<'integrations' | 'plugins'>('integrations');
	protected readonly isIntegrationsTab = computed(() => this.activeTab() === 'integrations');
	protected readonly isPluginsTab = computed(() => this.activeTab() === 'plugins');

	@ViewChild('searchElement', { static: false }) readonly searchElement: ElementRef;

	public filters = [
		{
			label: IntegrationFilterEnum.ALL,
			value: 'all'
		},
		{
			label: IntegrationFilterEnum.FREE,
			value: 'false'
		},
		{
			label: IntegrationFilterEnum.PAID,
			value: 'true'
		}
	];

	constructor(
		private readonly _integrationsStore: IntegrationsStoreService,
		private readonly renderer: Renderer2,
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute
	) {}

	ngOnInit() {
		// Check if we should show plugins tab based on current URL
		if (this.router.url.includes('/integrations/plugins')) {
			this.activeTab.set('plugins');
		}
	}

	/**
	 * Change active tab
	 */
	changeTab(tab: 'integrations' | 'plugins'): void {
		this.activeTab.set(tab);

		// Navigate to the appropriate route
		if (tab === 'plugins') {
			// Navigate to plugins route
			this.router.navigate(['/pages/integrations/plugins']);
		} else {
			// Navigate back to integrations
			this.router.navigate(['/pages/integrations/new']);
		}
	}

	/**
	 * Set selected integration type
	 */
	setSelectedIntegrationType(integrationTypeId: string): void {
		this._integrationsStore.setSelectedIntegrationTypeId(integrationTypeId);
	}

	/**
	 * Set selected integration filter
	 */
	setSelectedIntegrationFilter(filter: string): void {
		this._integrationsStore.setSelectedIntegrationFilter(filter);
	}

	/**
	 * Search integrations
	 */
	doSearch(event: Event): void {
		const target = event.target as HTMLInputElement;
		this._integrationsStore.searchIntegration(target.value);
	}

	/**
	 * Clear filters
	 */
	clearFilter(): void {
		this._integrationsStore.clearFilters();
		if (this.searchElement?.nativeElement) {
			this.renderer.setProperty(this.searchElement.nativeElement, 'value', InitialFilter.searchQuery);
		}
	}
}
