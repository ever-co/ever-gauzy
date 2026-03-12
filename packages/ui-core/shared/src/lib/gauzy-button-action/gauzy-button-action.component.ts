import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { ComponentEnum } from '@gauzy/ui-core/common';

@Component({
	selector: 'ngx-gauzy-button-action',
	templateUrl: './gauzy-button-action.component.html',
	styleUrls: ['./gauzy-button-action.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class GauzyButtonActionComponent {
	/** Whether the action buttons are disabled / hidden. */
	readonly isDisable = input<boolean>(true);

	/** Whether the layout selector toggle is shown. */
	readonly hasLayoutSelector = input<boolean>(true);

	/** The component name passed to the layout selector. */
	readonly componentName = input<ComponentEnum>();

	/** Template reference for the primary action button. */
	readonly buttonTemplate = input<TemplateRef<HTMLElement>>();

	/** Template reference for the visible-state button. */
	readonly buttonTemplateVisible = input<TemplateRef<HTMLElement>>();
}
