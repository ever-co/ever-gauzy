import { Pipe, PipeTransform } from '@angular/core';
import { QueueItem, SyncStatus } from '../models/logs.models';

@Pipe({name:'filterStatus'})
export class FilterStatusPipe implements PipeTransform {
  transform(items: QueueItem[]|null, status: SyncStatus): QueueItem[]{
    if(!items) return [];
    return items.filter(i=>i.status===status);
  }
}
