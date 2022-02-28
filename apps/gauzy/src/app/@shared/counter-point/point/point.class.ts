export class Point {
  private color: string;
  constructor(color: string){
    this.color = color;
  }
  get getColor() {
    return this.color;
  }
  set setColor(color: string){
    this.color = color;
  }
}
