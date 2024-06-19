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
			.badge {
				display: flex;
				flex-direction: row;
				justify-content: center;
				align-items: center;
				position: relative;
				width: fit-content;
				height: 1.5rem;
				padding: 4px 8px;
				font-size: 12px;
				font-weight: 600;
				line-height: 15px;
				letter-spacing: 0em;
				text-align: left;
			}
		`
	]
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
