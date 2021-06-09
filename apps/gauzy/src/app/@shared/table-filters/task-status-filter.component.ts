import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';

@Component({
    template: `
        <ga-task-status-select
            [placeholder]="'TASKS_PAGE.TASKS_STATUS' | translate"
            (onChanged)="onChange($event)"
        ></ga-task-status-select>
    `,
})
export class TaskStatusFilterComponent extends DefaultFilter implements OnChanges {
    
    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event: string) {
        this.column.filterFunction(event);
    }
}