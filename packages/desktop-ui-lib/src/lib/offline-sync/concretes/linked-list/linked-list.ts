import { ILinkedList, ILinkedListNode } from '../../interfaces';
import { Node } from './node';

export class LinkedList<T> implements ILinkedList<T> {
	private _head: ILinkedListNode<T>;
	private _tail: ILinkedListNode<T>;

	constructor() {
		this._head = null;
		this._tail = null;
	}

	public get size(): number {
		return this.toArray().length;
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

	public search(data: T): ILinkedListNode<T> {
		let temp = this.head;
		while (temp) {
			if (temp.data === data) {
				return temp;
			}
			temp = temp.next;
		}
		return null;
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

	public append(data: T): ILinkedListNode<T> {
		const node = new Node(data);
		if (this.isEmpty()) {
			this._head = node;
			this._tail = node;
		} else {
			this._tail.next = node;
			this._tail = node;
		}
		return node;
	}

	public prepend(data: T): ILinkedListNode<T> {
		const node = new Node(data);
		if (this.isEmpty()) {
			this._tail = node;
		} else {
			node.next = this._head;
		}
		this._head = node;
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
		return node;
	}

	public remove(data: T): void {
		if (this.isEmpty()) {
			return;
		}

		if (this.head.data === data) {
			this.head = this.head.next;
			if (this.isEmpty()) {
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
	}

	public toString(): string {
		let temp = this.head;
		let result = '';
		while (temp) {
			result += `${temp.data} -> `;
			temp = temp.next;
		}
		result += 'null';
		return result;
	}
}
