import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@gauzy/ui-core/common';

@Component({
	selector: 'ngx-about',
	templateUrl: './about.component.html'
})
export class AboutComponent implements OnInit, OnDestroy {
	constructor(private readonly store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
