import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

`@UntilDestroy`()
`@Component`({
	selector: 'ga-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutSelectorComponent implements OnInit {
	protected readonly store = inject(Store);

	protected readonly layoutStyles = ComponentLayoutStyleEnum;
	protected readonly componentName = input<ComponentEnum>();

	public readonly componentLayoutStyle = signal<ComponentLayoutStyleEnum | undefined>(undefined);

	ngOnInit() {
		this.store.componentLayoutMap$
			.pipe(untilDestroyed(this))
			.subscribe((componentLayoutMap: Map<string, ComponentLayoutStyleEnum>) => {
				const dataLayout = componentLayoutMap.get(this.componentName());
				this.componentLayoutStyle.set(dataLayout);
			});
	}

	protected changeLayout(layout: ComponentLayoutStyleEnum) {
		this.store.setLayoutForComponent(this.componentName(), layout);
	}
}
