import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ngx-about',
	templateUrl: './about.component.html'
})
export class AboutComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
