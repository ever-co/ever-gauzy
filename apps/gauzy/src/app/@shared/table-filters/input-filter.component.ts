import {Component, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';

@Component({
    template: `
        <input 
            [formControl]="inputControl"
            class="form-control"
            [placeholder]="column.title"
        >
    `,
})
export class InputFilterComponent extends DefaultFilter implements OnInit, OnChanges {
    inputControl = new FormControl();

    constructor() {
        super();
    }

    ngOnInit() {
        this.inputControl.valueChanges
            .pipe(
                distinctUntilChanged(),
                debounceTime(this.delay),
                tap((value) => this.column.filterFunction(value))
            )
            .subscribe();
      }

    ngOnChanges(changes: SimpleChanges) {}
}