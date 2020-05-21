import { Component, OnInit, OnDestroy } from '@angular/core';
import { ExportAllService } from '../../../@core/services/exportAll.service';
import { saveAs } from 'file-saver';

@Component({
	selector: 'ngx-download',
	templateUrl: './export.component.html',
	styleUrls: ['./export.component.scss']
})
export class ExportComponent implements OnInit, OnDestroy {
	constructor(private exportAll: ExportAllService) {}

	ngOnInit() {}
	onDownloadAll() {
		this.exportAll
			.downloadAllData()
			.subscribe((data) => saveAs(data, `export.zip`));
	}

	onDownloadTemplates() {
		this.exportAll
			.downloadTemplates()
			.subscribe((data) => saveAs(data, `template.zip`));
	}

	ngOnDestroy() {}
}
