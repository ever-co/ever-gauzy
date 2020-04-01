import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ga-wip',
	template: `
		<div>
			<div
				style="display: flex; flex-direction: column; align-items: center; margin: 100px; 0px"
			>
				<nb-icon
					icon="flash-outline"
					style="font-size:50px; color: #cacaca"
				></nb-icon>
				<div>This page is coming soon!</div>
			</div>
		</div>
	`
})
export class WorkInProgressComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
