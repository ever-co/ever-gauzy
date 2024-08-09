export class Point {
	constructor(color: string) {
		this._color = color;
	}

	private _color: string;
	get color() {
		return this._color;
	}
	set color(color: string) {
		this._color = color;
	}

	get className(): string {
		return this._color;
	}
}
