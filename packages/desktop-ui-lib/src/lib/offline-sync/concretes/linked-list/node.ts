import { ILinkedListNode } from "../../interfaces";

export class Node<T> implements ILinkedListNode<T> {
	private _next: ILinkedListNode<T>;
	private _data: T;

	constructor(data: T) {
		this._data = data;
		this._next = null;
	};

	public get next(): ILinkedListNode<T> {
		return this._next;
	}
	public set next(value: ILinkedListNode<T>) {
		this._next = value;
	}

	public get data(): T {
		return this._data;
	}
	public set data(value: T) {
		this._data = value;
	}
}
