import { Component, OnInit, Input } from '@angular/core';
import { NbComponentStatus } from '@nebular/theme';
import { TaskStatusEnum } from '@gauzy/contracts';

@Component({
    selector: 'ngx-status-view',
    templateUrl: './status-view.component.html',
    styles: [
        `
			:host {
				display: flex;
			}
			/* Status pill in a smart-table cell. Sized from the shared
			   table-density tokens ($gauzy-density in themes.scss); the
			   literals are CSS-var fallbacks only. `align-items: center`
			   below is what makes the explicit height safe to shrink. */
			.badge {
				display: flex;
				flex-direction: row;
				justify-content: center;
				align-items: center;
				position: relative;
				width: fit-content;
				height: var(--gauzy-table-badge-height, 1.25rem);
				padding: var(--gauzy-table-chip-padding-y, 0.0625rem) var(--gauzy-table-chip-padding-x, 0.375rem);
				white-space: nowrap;
				font-size: var(--gauzy-table-header-font-size, 0.75rem);
				font-weight: 600;
				line-height: var(--gauzy-table-header-line-height, 0.9375rem);
				letter-spacing: 0em;
				text-align: left;
			}
		`
    ],
    standalone: false
})
export class StatusViewComponent implements OnInit {
	@Input() value: string;
	@Input() rowData: any;
	status: NbComponentStatus;

	ngOnInit(): void {
		switch (this.value) {
			case TaskStatusEnum.OPEN:
				this.status = 'basic';
				break;
			case TaskStatusEnum.IN_PROGRESS:
				this.status = 'info';
				break;
			case TaskStatusEnum.READY_FOR_REVIEW:
				this.status = 'info';
				break;
			case TaskStatusEnum.IN_REVIEW:
				this.status = 'info';
				break;
			case TaskStatusEnum.COMPLETED:
				this.status = 'success';
				break;
			case TaskStatusEnum.BLOCKED:
				this.status = 'danger';
				break;
			default:
				this.status = 'basic';
				break;
		}
	}
}
