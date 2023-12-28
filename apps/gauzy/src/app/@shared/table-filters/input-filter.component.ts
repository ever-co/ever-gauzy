import { Component, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap } from 'rxjs/operators';
import { Subscription } from 'rxjs/internal/Subscription';
import { DefaultFilter } from 'angular2-smart-table';

@Component({
    template: `
        <input [formControl]="inputControl" class="form-control" [placeholder]="column.title">
    `,
})
export class InputFilterComponent extends DefaultFilter implements OnInit, OnDestroy, OnChanges {
    public inputControl = new FormControl();
    private subscription: Subscription;

    constructor() {
        super();
    }

    ngOnInit() {
        this.subscription = this.inputControl.valueChanges
            .pipe(
                debounceTime(this.delay),
                distinctUntilChanged(),
                // tap((value) => this.column.filterFunction(value))
            )
            .subscribe();
    }

    /**
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges) { }

    /**
     *
     */
    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
