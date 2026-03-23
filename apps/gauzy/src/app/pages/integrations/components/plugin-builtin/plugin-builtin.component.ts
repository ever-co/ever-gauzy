import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IIntegration } from '@gauzy/contracts';
import { IntegrationsStoreService } from '@gauzy/ui-core/core';
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
import { IntegrationFiltersBase } from '../../integration-filters.base';

@Component({
	selector: 'ngx-plugin-builtin',
	templateUrl: './plugin-builtin.component.html',
	styleUrls: ['./plugin-builtin.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		AsyncPipe,
		NgOptimizedImage,
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
export class PluginBuiltinComponent extends IntegrationFiltersBase {
	protected readonly _integrationsStore = inject(IntegrationsStoreService);
	private readonly _router = inject(Router);

	@ViewChild('searchInput', { static: false }) readonly searchInput: ElementRef<HTMLInputElement>;

	protected override getSearchInputRef(): ElementRef<HTMLInputElement> | undefined {
		return this.searchInput;
	}

	navigateTo(integration: IIntegration): void {
		if (integration.isComingSoon) return;
		this._router.navigate(['/pages/integrations', integration.redirectUrl]);
	}
}
