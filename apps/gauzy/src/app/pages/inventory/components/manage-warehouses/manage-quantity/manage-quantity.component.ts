import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { WarehouseService } from 'apps/gauzy/src/app/@core';

@Component({
	templateUrl: './manage-quantity.component.html',
	styles: ['input { width: 80px }']
})
export class ManageQuantityComponent implements ViewCell, AfterViewInit {
	value: any;
	rowData: any;

	@ViewChild('quantity', { static: true }) quantityInput: ElementRef;

	constructor(private warehouseService: WarehouseService) {}

	ngAfterViewInit() {
		// this.quantityInput.nativeElement.value = this.value;

		fromEvent(this.quantityInput.nativeElement, 'change')
			.pipe(debounceTime(100))
			.subscribe(async (ev: any) => {
				if (+ev.target.value < 0) return;
				await this.warehouseService.updateWarehouseProductCount(
					this.rowData.id,
					+ev.target.value
				);
			});
	}
}
