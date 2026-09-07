import './nebular-jsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { NbStatus } from '@gauzy/ui-react-components';

export type NbButtonAppearance = 'filled' | 'outline' | 'ghost' | 'hero';
export type NbButtonSize = 'tiny' | 'small' | 'medium' | 'large' | 'giant';
export type NbButtonShape = 'rectangle' | 'semi-round' | 'round';

export interface NbButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** `nbButton` appearance (`outline` = the Angular `outline` attribute). */
	appearance?: NbButtonAppearance;
	size?: NbButtonSize;
	status?: NbStatus;
	shape?: NbButtonShape;
	/** Renders the "icon only" paddings (`icon-start icon-end`). */
	iconOnly?: boolean;
}

/**
 * A `<button nbButton>` for React: emits the attribute + classes the Nebular `NbButtonComponent`
 * host would carry (`appearance-*`, `size-*`, `status-*`, `shape-*`), so the global Nebular
 * button theme — including the app's density overrides — styles it exactly like the Angular
 * buttons on the Time Tracking tab.
 */
export const NbButton = forwardRef<HTMLButtonElement, NbButtonProps>(function NbButton(
	{ appearance = 'filled', size = 'medium', status = 'basic', shape = 'rectangle', iconOnly = false, className, type = 'button', children, ...rest },
	ref
) {
	const classes = [
		`appearance-${appearance}`,
		`size-${size}`,
		`status-${status}`,
		`shape-${shape}`,
		iconOnly ? 'icon-start icon-end' : '',
		'nb-transition',
		className ?? ''
	]
		.filter(Boolean)
		.join(' ');
	return (
		<button ref={ref} nbbutton="" type={type} className={classes} {...rest}>
			{children}
		</button>
	);
});
