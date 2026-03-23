import { ChangeDetectionStrategy, Component, ElementRef, Renderer2, ViewChild, inject } from '@angular/core';
import { IntegrationsStoreService } from '@gauzy/ui-core/core';
import { IntegrationFiltersBase } from './integration-filters.base';

@Component({
	selector: 'ngx-integrations',
	templateUrl: './integrations.component.html',
	styleUrls: ['./integrations.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class IntegrationsComponent extends IntegrationFiltersBase {
	protected readonly _integrationsStore = inject(IntegrationsStoreService);
	private readonly renderer = inject(Renderer2);

	@ViewChild('searchElement', { static: false }) readonly searchElement: ElementRef<HTMLInputElement>;

	protected override getRenderer(): Renderer2 {
		return this.renderer;
	}

	protected override getSearchInputRef(): ElementRef<HTMLInputElement> | undefined {
		return this.searchElement;
	}
}
