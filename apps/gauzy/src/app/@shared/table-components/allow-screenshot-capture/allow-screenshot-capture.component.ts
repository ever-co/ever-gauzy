import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
  selector: 'gauzy-allow-screenshot-capture',
  templateUrl: './allow-screenshot-capture.component.html',
  styleUrls: ['./allow-screenshot-capture.component.scss']
})
export class AllowScreenshotCaptureComponent implements OnInit, ViewCell {
  @Input()
  value: string | number;
  @Input()
  rowData: any;
  @Output()
  allowScreenshotCaptureChange: EventEmitter<boolean> = new EventEmitter();
  constructor() { }

  ngOnInit(): void { }

  onCheckedChange(event: boolean) {
    this.allowScreenshotCaptureChange.emit(event);
  }
}
