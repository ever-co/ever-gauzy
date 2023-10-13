import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'hash'
})
export class HashNumberPipe implements PipeTransform {
    transform(value: number | string): string {
        if (value) {
            const numericValue = isNaN(Number(value)) ? value : Number(value);
            return '#' + numericValue;
        }
        return ''; // Return an empty string for non-numeric or falsy values
    }
}
