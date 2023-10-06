import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'hash'
})
export class HashNumberPipe implements PipeTransform {
    transform(value: number): string {
        if (typeof value === 'number') {
            return '#' + value;
        } else {
            return value; // Return an empty string for non-numeric values
        }
    }
}
