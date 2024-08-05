import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
	selector: 'ga-wip',
	template: `
		<div>
			<div style="display: flex; flex-direction: column; align-items: center; margin: 100px; 0px">
				<nb-icon icon="flash-outline" style="font-size:50px; color: #cacaca"></nb-icon>
				<div>{{ 'COMING_SOON' | translate }}</div>
			</div>
		</div>
	`
})
export class WorkInProgressComponent implements OnInit, OnDestroy {
	ngOnInit() {}

	ngOnDestroy() {}
}
