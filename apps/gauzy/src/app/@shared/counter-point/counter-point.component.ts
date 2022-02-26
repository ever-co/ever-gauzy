import { Component, Input, OnInit } from '@angular/core';
import { Point } from './point/point.class';

@Component({
  selector: 'gauzy-counter-point',
  templateUrl: './counter-point.component.html',
  styleUrls: ['./counter-point.component.scss']
})
export class CounterPointComponent implements OnInit {
  @Input() total: number;
  @Input() value: number;
  @Input() color: string;
  points: Point[] = [];
  DEFAULT_COLOR = '#D8E3ED66';
  constructor() { }

  ngOnInit(): void {
    this.generateColorizedPoints();
  }

  generateColorizedPoints(){
    if(this.total > 30) {
      this.value = this.value / this.total * 30;
      this.total = 30;
    }
    for(let i = 0; i < this.total; i++){
      if(i < this.value){
        this.points.push(new Point(this.color));
      }else{
        this.points.push(new Point(this.DEFAULT_COLOR));
      }
    }
  }

}
