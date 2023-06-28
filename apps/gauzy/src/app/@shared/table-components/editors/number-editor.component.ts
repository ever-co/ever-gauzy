import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Cell, DefaultEditor } from 'ng2-smart-table';

@Component({
    template: `<input
        class="form-control"
        [min]="0"
        [type]="'number'"
        [(ngModel)]="cell.newValue"
        [name]="cell.getId()"
    >`,
})
export class NumberEditorComponent extends DefaultEditor implements OnInit {

    @Input() cell!: Cell;
    @Output() onConfirm: EventEmitter<number> = new EventEmitter<number>();

    constructor() {
        super();
    }

    ngOnInit() {
        if (this.cell.newValue) {
            this.cell.newValue = +this.cell.newValue; // Convert the input to a number
        }
    }
}
