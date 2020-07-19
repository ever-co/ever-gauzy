import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-about',
	templateUrl: './about.component.html'
})
export class AboutComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
