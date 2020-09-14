import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-settings',
	templateUrl: './settings.component.html',
	styles: [
		'.header { display: flex; align-items: center; justify-content: space-between; }'
	]
})
export class SettingsComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
