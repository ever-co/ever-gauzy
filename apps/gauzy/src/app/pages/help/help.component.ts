import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss']
})
export class HelpComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
