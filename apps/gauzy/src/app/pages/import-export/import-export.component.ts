import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { ExportAllService } from '../../@core/services/exportAll.service';

@Component({
	selector: 'ngx-download',
	templateUrl: './import-export.component.html',
	styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent implements OnInit, OnDestroy {
	constructor(private store: Store, private exportAll: ExportAllService) {}

	ngOnInit() {}
	onDownloadAll() {
		this.exportAll.downloadAllData();
	}

	ngOnDestroy() {}
}
