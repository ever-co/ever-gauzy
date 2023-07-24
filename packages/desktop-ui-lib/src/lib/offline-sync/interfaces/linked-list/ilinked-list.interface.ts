import { ILinkedListNode } from './ilinked-list-node.interface';

export interface ILinkedList<T> {
	head: ILinkedListNode<T>;
	tail: ILinkedListNode<T>;
	size: number;
	append(data: T): ILinkedListNode<T>;
	prepend(data: T): ILinkedListNode<T>;
	shift(): ILinkedListNode<T>;
	pop(): ILinkedListNode<T>;
	insert(index: number, data: T): ILinkedListNode<T>;
	get(index: number): ILinkedListNode<T>;
	set(index: number, data: T): ILinkedListNode<T>;
	toArray(): T[];
	isEmpty(): boolean;
	remove(data: T): void;
}
