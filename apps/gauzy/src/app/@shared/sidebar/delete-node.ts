import { IHelpCenter } from '@gauzy/models';

export function isEqual(graph: IHelpCenter[], id: number) {
	const succeesCondition = (node) => node.id === id;
	const i = graph.findIndex(succeesCondition);
	if (i >= 0) {
		graph.splice(i, 1);
		return true;
	}
	for (let i = 0; i < graph.length; i++) {
		if (graph[i].children) {
			if (this.isEqual(graph[i].children, id)) {
				if (graph[i].children.length === 0) {
					delete graph[i].children;
				}
			}
		}
	}
}
