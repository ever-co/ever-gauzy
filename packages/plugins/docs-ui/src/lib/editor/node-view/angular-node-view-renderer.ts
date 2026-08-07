import {
	ApplicationRef,
	ComponentRef,
	Directive,
	EnvironmentInjector,
	Injector,
	NgZone,
	Type,
	createComponent,
	input
} from '@angular/core';
import { Editor, NodeViewRenderer, NodeViewRendererProps } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Minimal in-house Angular ↔ ProseMirror node-view bridge (spec 05 §6.3).
 *
 * Tier 1 (`packages/ui-core/shared/.../rich-text-editor/node-view/`) will host the
 * canonical copy once it lands; until then the editor chunk carries this local one.
 * `createComponent()` + `ApplicationRef.attachView` — no third-party Angular binding.
 */

/**
 * Abstract base for node-view components: `node`, `selected`, `editor`,
 * `getPos`, `updateAttributes`, `deleteNode` arrive as signal inputs so
 * OnPush components stay consistent (spec 05 §6.3). Decorated with a
 * selector-less `@Directive()` so the inherited signal inputs compile.
 */
@Directive()
export abstract class AngularNodeViewComponent {
	/** Current ProseMirror node (patched on every same-type update). */
	public readonly node = input.required<ProseMirrorNode>();
	/** The owning TipTap editor. */
	public readonly editor = input.required<Editor>();
	/** True while the node is node-selected. */
	public readonly selected = input<boolean>(false);
	/** Resolves the node's current position in the doc. */
	public readonly getPos = input<() => number | undefined>(() => undefined);
	/** Merges the given attrs into the node (single transaction). */
	public readonly updateAttributes = input<(attrs: Record<string, unknown>) => void>(() => void 0);
	/** Deletes the node from the doc. */
	public readonly deleteNode = input<() => void>(() => void 0);
}

export interface IAngularNodeViewRendererOptions {
	/** Injector of the editor component (provides ApplicationRef, NgZone, services). */
	injector: Injector;
}

/**
 * Returns a ProseMirror `NodeView` factory rendering the given Angular component.
 *
 * - `update(node)` patches the `node` input and returns true for same-type updates
 *   (no re-mount).
 * - An optional content hole is exposed through a `[data-node-view-content]`
 *   element in the component template (used by `callout`).
 * - Draggable atoms get `data-drag-handle` on the host so ProseMirror initiates
 *   drags from the whole card.
 * - The component is created/destroyed inside the zone; ProseMirror-driven DOM
 *   mutation stays outside (spec 05 §6.3).
 */
export function AngularNodeViewRenderer<T extends AngularNodeViewComponent>(
	component: Type<T>,
	options: IAngularNodeViewRendererOptions
): NodeViewRenderer {
	return (props: NodeViewRendererProps) => {
		const injector = options.injector;
		const appRef = injector.get(ApplicationRef);
		const environmentInjector = injector.get(EnvironmentInjector);
		const zone = injector.get(NgZone);

		let currentNode: ProseMirrorNode = props.node as ProseMirrorNode;

		const componentRef: ComponentRef<T> = zone.run(() =>
			createComponent(component, { environmentInjector, elementInjector: injector })
		);

		const getPos = (): number | undefined => {
			const pos = (props.getPos as () => number | undefined)();
			return typeof pos === 'number' ? pos : undefined;
		};

		const updateAttributes = (attrs: Record<string, unknown>): void => {
			const pos = getPos();
			if (pos === undefined) return;
			const { view } = props.editor;
			view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs }));
		};

		const deleteNode = (): void => {
			const pos = getPos();
			if (pos === undefined) return;
			const { view } = props.editor;
			view.dispatch(view.state.tr.delete(pos, pos + currentNode.nodeSize));
		};

		zone.run(() => {
			componentRef.setInput('node', currentNode);
			componentRef.setInput('editor', props.editor);
			componentRef.setInput('selected', false);
			componentRef.setInput('getPos', getPos);
			componentRef.setInput('updateAttributes', updateAttributes);
			componentRef.setInput('deleteNode', deleteNode);
			appRef.attachView(componentRef.hostView);
			componentRef.changeDetectorRef.detectChanges();
		});

		const dom = componentRef.location.nativeElement as HTMLElement;
		if (currentNode.type.spec.draggable && currentNode.type.spec.atom) {
			dom.setAttribute('data-drag-handle', '');
		}
		const contentDOM = currentNode.isLeaf
			? null
			: (dom.querySelector('[data-node-view-content]') as HTMLElement | null);

		return {
			dom,
			contentDOM: contentDOM ?? undefined,
			update: (node: ProseMirrorNode) => {
				if (node.type !== currentNode.type) return false;
				currentNode = node;
				zone.run(() => {
					componentRef.setInput('node', node);
					componentRef.changeDetectorRef.detectChanges();
				});
				return true;
			},
			selectNode: () => {
				zone.run(() => {
					componentRef.setInput('selected', true);
					componentRef.changeDetectorRef.detectChanges();
				});
				dom.classList.add('gz-node-view--selected');
			},
			deselectNode: () => {
				zone.run(() => {
					componentRef.setInput('selected', false);
					componentRef.changeDetectorRef.detectChanges();
				});
				dom.classList.remove('gz-node-view--selected');
			},
			// Let interactive controls inside the node view handle their own events.
			stopEvent: (event: Event) => {
				const target = event.target as HTMLElement | null;
				return !!target?.closest('button, a, input, select, textarea, [data-node-view-interactive]');
			},
			// Ignore mutations outside the content hole (Angular re-renders chrome freely).
			ignoreMutation: (mutation: { type: string; target: Node }) => {
				if (mutation.type === 'selection') return false;
				return !contentDOM || !contentDOM.contains(mutation.target);
			},
			destroy: () => {
				zone.run(() => {
					appRef.detachView(componentRef.hostView);
					componentRef.destroy();
				});
			}
		};
	};
}
