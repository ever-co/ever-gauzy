import { Component, OnInit, inject, input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ga-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss'],
	standalone: false
})
export class LayoutSelectorComponent implements OnInit {
	protected readonly store = inject(Store);

	protected readonly layoutStyles = ComponentLayoutStyleEnum;
	protected readonly componentName = input<ComponentEnum>();

	public componentLayoutStyle: ComponentLayoutStyleEnum;

	ngOnInit() {
		this.store.componentLayoutMap$
			.pipe(untilDestroyed(this))
			.subscribe((componentLayoutMap: Map<string, ComponentLayoutStyleEnum>) => {
				const dataLayout = componentLayoutMap.get(this.componentName());
				this.componentLayoutStyle = dataLayout;
			});
	}

	protected changeLayout(layout: ComponentLayoutStyleEnum) {
		this.store.setLayoutForComponent(this.componentName(), layout);
	}
}
