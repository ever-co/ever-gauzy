import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IIntegration, IntegrationFilterEnum } from '@gauzy/contracts';
import { InitialFilter, IntegrationsStoreService } from '@gauzy/ui-core/core';
import { ReplacePipe } from '@gauzy/ui-core/shared';
import {
	NbButtonModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTagModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';

@Component({
	selector: 'ngx-plugin-builtin',
	templateUrl: './plugin-builtin.component.html',
	styleUrls: ['./plugin-builtin.component.scss'],
	standalone: true,
	imports: [
		AsyncPipe,
		NbButtonModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTagModule,
		NbTooltipModule,
		TranslateModule,
		ReplacePipe
	]
})
export class PluginBuiltinComponent {
	// The store types as IIntegrationViewModel[] but the API returns IIntegration[] at runtime
	public readonly integrations$: Observable<IIntegration[]> = this._integrationsStore.integrations$ as Observable<IIntegration[]>;
	public readonly isLoading$: Observable<boolean> = this._integrationsStore.isLoading$;
	public readonly integrationGroups$: Observable<any[]> = this._integrationsStore.integrationGroups$;
	public readonly selectedIntegrationTypeId$: Observable<string> = this._integrationsStore.selectedIntegrationTypeId$;
	public readonly selectedIntegrationFilter$: Observable<string> = this._integrationsStore.selectedIntegrationFilter$;

	public readonly filters = [
		{ label: IntegrationFilterEnum.ALL, value: 'all' },
		{ label: IntegrationFilterEnum.FREE, value: 'false' },
		{ label: IntegrationFilterEnum.PAID, value: 'true' }
	];

	@ViewChild('searchInput', { static: false }) readonly searchInput: ElementRef<HTMLInputElement>;

	constructor(
		private readonly _integrationsStore: IntegrationsStoreService,
		private readonly _router: Router
	) {}

	doSearch(event: Event): void {
		const query = (event.target as HTMLInputElement).value;
		this._integrationsStore.searchIntegration(query);
	}

	setSelectedIntegrationType(integrationTypeId: string): void {
		this._integrationsStore.setSelectedIntegrationTypeId(integrationTypeId);
	}

	setSelectedIntegrationFilter(filter: string): void {
		this._integrationsStore.setSelectedIntegrationFilter(filter);
	}

	clearFilter(): void {
		this._integrationsStore.clearFilters();
		if (this.searchInput?.nativeElement) {
			this.searchInput.nativeElement.value = InitialFilter.searchQuery;
		}
	}

	navigateTo(integration: IIntegration): void {
		if (integration.isComingSoon) return;
		this._router.navigate(['/pages/integrations', integration.redirectUrl]);
	}
}
