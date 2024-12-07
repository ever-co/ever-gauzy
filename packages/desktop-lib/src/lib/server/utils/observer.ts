export class Observer<T, U> {
	private callback: (data: T) => U;

	constructor(callback: (data: T) => U) {
		this.callback = callback;
	}

	public notify(data: T) {
		this.callback(data);
	}
}
