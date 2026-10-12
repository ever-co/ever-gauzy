import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { ComponentEnum } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
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
		const componentName = this.componentName();
		if (!componentName) {
			return;
		}
		// `componentLayout$`, not the raw map: the map only holds a key once the
		// user has explicitly toggled THIS page, so reading it directly left both
		// buttons inactive on every page nobody had ever switched — and on any
		// page whose `ComponentEnum` key changed, which strands the old entry.
		// Meanwhile the page itself renders the effective layout (per-component
		// override, then the user's preferred layout, then `SYSTEM_DEFAULT_LAYOUT`),
		// so the two disagreed. This is the same stream the pages subscribe to,
		// which is what keeps the highlight on whatever is actually on screen.
		this.store
			.componentLayout$(componentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout: ComponentLayoutStyleEnum) => {
				this.componentLayoutStyle.set(componentLayout);
			});
	}

	protected changeLayout(layout: ComponentLayoutStyleEnum) {
		this.store.setLayoutForComponent(this.componentName(), layout);
	}
}
