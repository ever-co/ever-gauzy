import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExportAllService } from '../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';
@Component({
	selector: 'ngx-download',
	templateUrl: './import-export.component.html',
	styleUrls: ['./import-export.component.scss']
})
export class ImportExportComponent implements OnInit, OnDestroy {
	constructor(private exportAll: ExportAllService) {}

	ngOnInit() {}
	onDownloadAll() {
		this.exportAll
			.downloadAllData()
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	ngOnDestroy() {}
}
