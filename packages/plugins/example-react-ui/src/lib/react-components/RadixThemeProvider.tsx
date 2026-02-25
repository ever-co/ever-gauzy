import { useEffect, useState, type ReactNode } from 'react';
import { Theme } from '@radix-ui/themes';

// Import Radix UI Themes CSS
import '@radix-ui/themes/styles.css';

/**
 * Props for RadixThemeProvider.
 */
export interface RadixThemeProviderProps {
	children: ReactNode;
	/** Theme appearance: 'light' | 'dark' | 'inherit' */
	appearance?: 'light' | 'dark' | 'inherit';
	/** Accent color */
	accentColor?: 'blue' | 'indigo' | 'violet' | 'purple' | 'cyan' | 'teal' | 'green' | 'orange' | 'red';
	/** Gray color scale */
	grayColor?: 'gray' | 'mauve' | 'slate' | 'sage' | 'olive' | 'sand';
	/** Border radius */
	radius?: 'none' | 'small' | 'medium' | 'large' | 'full';
	/** Scaling factor */
	scaling?: '90%' | '95%' | '100%' | '105%' | '110%';
}

/**
 * Provides Radix UI Theme context to React components.
 *
 * This wrapper ensures that Radix UI Themes CSS is loaded and the theme
 * context is available to all child components.
 *
 * @example
 * ```tsx
 * <RadixThemeProvider appearance="light" accentColor="blue">
 *   <MyReactComponent />
 * </RadixThemeProvider>
 * ```
 */
export function RadixThemeProvider({
	children,
	appearance = 'light',
	accentColor = 'blue',
	grayColor = 'slate',
	radius = 'medium',
	scaling = '100%'
}: RadixThemeProviderProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Prevent SSR hydration mismatch
	if (!mounted) {
		return null;
	}

	return (
		<Theme
			appearance={appearance}
			accentColor={accentColor}
			grayColor={grayColor}
			radius={radius}
			scaling={scaling}
			style={{ backgroundColor: 'transparent' }}
		>
			{children}
		</Theme>
	);
}

export default RadixThemeProvider;
