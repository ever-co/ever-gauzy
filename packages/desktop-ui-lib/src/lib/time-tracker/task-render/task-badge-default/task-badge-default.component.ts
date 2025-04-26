import { Component, Input, OnInit } from '@angular/core';
import { TaskStatusEnum } from '@gauzy/contracts';
import { NbComponentStatus } from '@nebular/theme';

@Component({
    selector: 'gauzy-task-badge-default',
    templateUrl: './task-badge-default.component.html',
    styleUrls: ['./task-badge-default.component.scss'],
    standalone: false
})
export class TaskBadgeDefaultComponent implements OnInit {
	@Input() taskBadge: string;
	public status: NbComponentStatus;

	ngOnInit(): void {
		switch (this.taskBadge) {
			case TaskStatusEnum.OPEN:
				this.status = 'basic';
				break;
			case TaskStatusEnum.IN_PROGRESS:
				this.status = 'info';
				break;
			case TaskStatusEnum.READY_FOR_REVIEW:
				this.status = 'warning';
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
