import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Cell, DefaultEditor } from 'angular2-smart-table';

@Component({
    template: `<input
        class="form-control"
        [min]="0"
        [type]="'number'"
        (change)="cell.setValue($event)"
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
        if (this.cell.getValue()) {
            this.cell.setValue(this.cell.getNewRawValue());
        }
        // if (this.cell.value) {
        //     this.cell.value = +this.cell.value; // Convert the input to a number
        // }
    }
}
