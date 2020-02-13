import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-download',
	templateUrl: './download-all.component.html',
	styleUrls: ['./download-all.component.scss']
})
export class DownloadComponent implements OnInit, OnDestroy {
	constructor(private store: Store) {}

	ngOnInit() {}

	ngOnDestroy() {}
}
