import { ILinkedList, ILinkedListNode } from '../../interfaces';
import { Node } from './node';

export class LinkedList<T> implements ILinkedList<T> {
	private _head: ILinkedListNode<T>;
	private _tail: ILinkedListNode<T>;
	private _size: number;
	constructor(data?: T) {
		if (data === null || data === undefined) {
			this._head = null;
			this._tail = null;
			this._size = 0;
		} else {
			const node = new Node(data);
			this._head = node;
			this._tail = node;
			this._size = 1;
		}
	}

	public get size(): number {
		return this._size;
	}

	public get tail(): ILinkedListNode<T> {
		return this._tail;
	}
	public set tail(value: ILinkedListNode<T>) {
		this._tail = value;
	}

	public get head(): ILinkedListNode<T> {
		return this._head;
	}
	public set head(value: ILinkedListNode<T>) {
		this._head = value;
	}
	public static arrayToLinkedList<T>(array: T[]): LinkedList<T> {
		const linkedList = new LinkedList<T>();
		for (const item of array) {
			linkedList.append(item);
		}
		return linkedList;
	}
	public isEmpty(): boolean {
		return this._head === null;
	}
	public toArray(): T[] {
		const arr: T[] = [];
		let current = this.head;
		while (current !== null) {
			arr.push(current.data);
			current = current.next;
		}
		return arr;
	}

	public get(index: number): ILinkedListNode<T> {
		if (index < 0 || index > this._size) return null;
		let node: ILinkedListNode<T> = this._head;
		for (let i = 0; i < index; i++) {
			node = node.next;
		}
		return node;
	}
	public set(index: number, data: T): ILinkedListNode<T> {
		const node: ILinkedListNode<T> = this.get(index);
		if (!node) return null;
		node.data = data;
		return node;
	}
	public insert(index: number, data: T): ILinkedListNode<T> {
		if (!index) return this.prepend(data);
		if (index === this._size) return this.append(data);
		if (index < 0 || index > this._size) return null;
		const node: ILinkedListNode<T> = new Node(data);
		const temp: ILinkedListNode<T> = this.get(index - 1);
		node.next = temp.next;
		temp.next = node;
		this._size++;
		return node;
	}

	public append(data: T): ILinkedListNode<T> {
		const node = new Node(data);
		if (this.isEmpty()) {
			this._head = node;
			this._tail = node;
		} else {
			this._tail.next = node;
			this._tail = node;
		}
		this._size++;
		return node;
	}
	public prepend(data: T): ILinkedListNode<T> {
		const node = new Node(data);
		if (!this.isEmpty()) {
			this._tail = node;
		} else {
			node.next = this._head;
		}
		this._head = node;
		this._size++;
		return node;
	}

	public shift(): ILinkedListNode<T> {
		if (this.isEmpty()) return null;
		const node = this._head;
		if (this.head === this.tail) {
			// Only one node in the linked list
			this.head = null;
			this.tail = null;
		} else {
			this.head = this.head.next;
		}

		this._size--;

		return node;
	}

	public pop(): ILinkedListNode<T> {
		if (this.isEmpty()) return null;
		const node = this.tail;
		if (this.head === this.tail) {
			// Only one node in the linked list
			this.head = null;
			this.tail = null;
		} else {
			let current = this.head;
			while (current.next !== this.tail) {
				current = current.next;
			}
			current.next = null;
			this.tail = current;
		}
		this._size--;
		return node;
	}

	public remove(data: T): void {
		if (this.isEmpty()) {
			return;
		}

		if (this.head.data === data) {
			this.head = this.head.next;
			if (this.head === null) {
				this.tail = null;
			}
			return;
		}

		let current = this.head;
		while (current.next !== null) {
			if (current.next.data === data) {
				current.next = current.next.next;
				if (current.next === null) {
					this.tail = current;
				}
				return;
			}
			current = current.next;
		}
		this._size--;
	}
}
