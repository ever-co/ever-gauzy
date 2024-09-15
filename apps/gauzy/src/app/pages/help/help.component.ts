import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ngx-help',
	templateUrl: './help.component.html'
})
export class HelpComponent implements OnInit, OnDestroy {
	constructor(private readonly store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
