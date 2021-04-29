import {
	Component,
	ViewChild,
	ElementRef,
	AfterViewInit,
	OnInit
} from '@angular/core';
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
		fromEvent(this.quantityInput.nativeElement, 'change')
			.pipe(debounceTime(100))
			.subscribe(async (ev: any) => {
				if (+ev.target.value < 0) return;

				if (this.rowData.type == 'variant') {
					await this.warehouseService.updateWarehouseProductVariantCount(
						this.rowData.id,
						+ev.target.value
					);
				} else {
					await this.warehouseService.updateWarehouseProductCount(
						this.rowData.id,
						+ev.target.value
					);
				}
			});
	}
}
