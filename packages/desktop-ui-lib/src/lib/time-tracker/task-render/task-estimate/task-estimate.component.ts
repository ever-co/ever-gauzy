import { Component } from '@angular/core';
import { TaskRenderComponent } from '../task-render.component';

@Component({
	selector: 'gauzy-task-estimate',
	templateUrl: './task-estimate.component.html',
	styleUrls: ['./task-estimate.component.scss']
})
export class TaskEstimateComponent extends TaskRenderComponent { }
