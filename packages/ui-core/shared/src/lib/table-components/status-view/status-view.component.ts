import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbBadgeModule } from '@nebular/theme';
import { TaskStatusEnum } from '@gauzy/contracts';
import { ReplacePipe } from '../../pipes/replace.pipe';
import { TaskBadgeViewComponentModule } from '../../tasks/task-badge-view/task-badge-view.module';

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
	],
	standalone: true,
	imports: [CommonModule, NbBadgeModule, ReplacePipe, TaskBadgeViewComponentModule]
})
export class StatusViewComponent implements OnInit {
	@Input() value: string;
	@Input() rowData: any;
	status: any;

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
