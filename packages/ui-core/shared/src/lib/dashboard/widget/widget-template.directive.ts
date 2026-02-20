import { Directive } from '@angular/core';

/**
 * Marker directive to tag ng-template elements as dashboard widgets.
 * Used with @ViewChildren(WidgetTemplateDirective, { read: TemplateRef })
 * to dynamically collect widget templates without requiring duplicate template names.
 *
 * Usage:
 * ```html
 * <ng-template gaWidgetTemplate>
 *   <!-- widget content -->
 * </ng-template>
 * ```
 */
@Directive({
	selector: '[gaWidgetTemplate]',
	standalone: true
})
export class WidgetTemplateDirective {}
