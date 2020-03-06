import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';


@Component({
  selector: 'ngx-tags-color',
  templateUrl: './tags-color.component.html',
  styleUrls: ['./tags-color.component.scss']
})
export class TagsColorComponent implements ViewCell {

  
  @Input()
  value: string | number;
  rowData: any;

}
