import { Directive } from '@angular/core';

/**
 * Marker directive to tag ng-template elements as dashboard windows.
 * Used with @ViewChildren(WindowTemplateDirective, { read: TemplateRef })
 * to dynamically collect window templates without requiring duplicate template names.
 *
 * Usage:
 * ```html
 * <ng-template gaWindowTemplate>
 *   <!-- window content -->
 * </ng-template>
 * ```
 */
@Directive({
	selector: '[gaWindowTemplate]',
	standalone: true
})
export class WindowTemplateDirective {}
