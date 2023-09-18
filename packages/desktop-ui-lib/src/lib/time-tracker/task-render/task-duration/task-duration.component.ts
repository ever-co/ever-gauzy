import { Component } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';

@Component({
	selector: 'gauzy-task-duration',
	templateUrl: './task-duration.component.html',
	styleUrls: ['./task-duration.component.scss']
})
export class TaskDurationComponent extends TaskRenderComponent { }
