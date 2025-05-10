import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-layout-selector',
    templateUrl: './layout-selector.component.html',
    styleUrls: ['./layout-selector.component.scss'],
    standalone: false
})
export class LayoutSelectorComponent implements OnInit, OnDestroy {
	public layoutStyles = ComponentLayoutStyleEnum;

	@Input() componentName: ComponentEnum;
	componentLayoutStyle: ComponentLayoutStyleEnum;

	constructor(private readonly store: Store) {}

	ngOnInit() {
		this.store.componentLayoutMap$
			.pipe(untilDestroyed(this))
			.subscribe((componentLayoutMap: Map<string, ComponentLayoutStyleEnum>) => {
				const dataLayout = componentLayoutMap.get(this.componentName);
				this.componentLayoutStyle = dataLayout;
			});
	}

	changeLayout(layout: ComponentLayoutStyleEnum) {
		this.store.setLayoutForComponent(this.componentName, layout);
	}

	ngOnDestroy() {}
}
