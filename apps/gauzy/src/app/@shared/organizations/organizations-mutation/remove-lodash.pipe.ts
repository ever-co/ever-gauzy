import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'removeLodash'
})
export class RemoveLodashPipe implements PipeTransform {

    transform(value: string, args?: any): any {
        return value.split('_').join(' ');
    }
}
