export interface ITreeNode<T> {
	data: T;
	children?: ITreeNode<T>[];
	expanded?: boolean;
}
