import {Component, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs/internal/Subscription';

@Component({
    template: `
        <input 
            [formControl]="inputControl"
            class="form-control"
            [placeholder]="column.title"
        >
    `,
})
export class InputFilterComponent extends DefaultFilter implements OnInit, OnDestroy, OnChanges {
    public inputControl = new FormControl();
    protected subscription: Subscription;

    constructor() {
        super();
    }

    ngOnInit() {
        this.subscription = this.inputControl.valueChanges
            .pipe(
                debounceTime(this.delay),
                distinctUntilChanged(),
                tap((value) => this.column.filterFunction(value))
            )
            .subscribe();
    }

    ngOnChanges(changes: SimpleChanges) {}

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}