import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { fromEvent } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { WarehouseService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-manage-warehouse-quantity-selector',
    templateUrl: './manage-quantity.component.html',
    styles: ['input { width: 80px }'],
    standalone: false
})
export class ManageQuantityComponent implements AfterViewInit {
	value: any;
	rowData: any;

	@ViewChild('quantity', { static: true }) quantity: ElementRef;

	constructor(private readonly warehouseService: WarehouseService) {}

	ngAfterViewInit() {
		// Using 'fromEvent' to create an observable from the 'change' event of the quantity input field
		fromEvent(this.quantity.nativeElement, 'change')
			.pipe(
				// Applying a debounce time of 100 milliseconds to avoid rapid firing of events
				debounceTime(100)
			)
			// Subscribing to the observable
			.subscribe(async (ev: any) => {
				// Checking if the quantity is less than 0 and returning if true
				if (+ev.target.value < 0) return;

				// Depending on the type of rowData, update the warehouse product count or variant count
				if (this.rowData.type == 'variant') {
					await this.warehouseService.updateWarehouseProductVariantCount(this.rowData.id, +ev.target.value);
				} else {
					await this.warehouseService.updateWarehouseProductCount(this.rowData.id, +ev.target.value);
				}
			});
	}
}
