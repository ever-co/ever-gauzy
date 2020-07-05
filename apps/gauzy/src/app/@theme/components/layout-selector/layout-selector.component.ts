import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subject } from 'rxjs';
import './layout-selector.component.scss';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { ComponentLayoutStyleEnum } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss']
})
export class LayoutSelectorComponent implements OnInit, OnDestroy {
	public layoutStyles = ComponentLayoutStyleEnum;
	private _ngDestroy$ = new Subject<void>();

	@Input() componentName: ComponentEnum;
	componentLayoutStyle: ComponentLayoutStyleEnum;

	constructor(private readonly store: Store) {}

	ngOnInit() {
		this.store.componentLayoutMap$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(
				(componentLayoutMap: Map<string, ComponentLayoutStyleEnum>) => {
					const dataLayout = componentLayoutMap.get(
						this.componentName
					);
					this.componentLayoutStyle = dataLayout;
				}
			);
	}

	changeLayout(layout: ComponentLayoutStyleEnum) {
		this.store.setLayoutForComponent(this.componentName, layout);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
