import React, { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error details captured by the PluginErrorBoundary.
 */
export interface PluginErrorInfo {
	/** The thrown error. */
	error: Error;
	/** React component stack trace. */
	componentStack?: string;
	/** Plugin ID if available from context. */
	pluginId?: string;
}

/**
 * Props for PluginErrorBoundary.
 */
export interface PluginErrorBoundaryProps {
	/** Child components to render. */
	children?: ReactNode;
	/** Plugin identifier (for scoped error reporting). */
	pluginId?: string;
	/** Custom fallback UI. Receives error info and a retry function. */
	fallback?: ReactNode | ((info: PluginErrorInfo, retry: () => void) => ReactNode);
	/** Called when an error is caught. Use for logging/reporting. */
	onError?: (info: PluginErrorInfo) => void;
}

interface State {
	error: Error | null;
	componentStack: string | null;
}

/**
 * React error boundary that isolates plugin component failures.
 *
 * Catches JavaScript errors anywhere in its child component tree,
 * logs them, shows a fallback UI, and provides a retry mechanism.
 * One plugin's crash won't take down the rest of the application.
 *
 * Automatically injected by `NgContextProvider` around all React
 * components rendered inside Angular. Can also be used manually
 * for finer-grained isolation within a plugin.
 *
 * @example Automatic (via NgContextProvider — no action needed)
 * ```tsx
 * // All React components inside Angular already have error boundaries
 * <div [gaReactHost]="MyComponent"></div>
 * ```
 *
 * @example Manual (for isolating parts of a plugin)
 * ```tsx
 * function Dashboard() {
 *   return (
 *     <div>
 *       <PluginErrorBoundary pluginId="charts" fallback={<p>Chart failed</p>}>
 *         <ChartWidget />
 *       </PluginErrorBoundary>
 *       <PluginErrorBoundary pluginId="stats">
 *         <StatsWidget />
 *       </PluginErrorBoundary>
 *     </div>
 *   );
 * }
 * ```
 */
export class PluginErrorBoundary extends Component<PluginErrorBoundaryProps, State> {
	override state: State = { error: null, componentStack: null };

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { error };
	}

	override componentDidCatch(error: Error, info: ErrorInfo): void {
		const componentStack = info.componentStack ?? null;
		this.setState({ componentStack });

		const errorInfo: PluginErrorInfo = {
			error,
			componentStack: componentStack ?? undefined,
			pluginId: this.props.pluginId
		};

		// Notify parent (Angular) via callback
		this.props.onError?.(errorInfo);

		// Always log — scoped by plugin ID if available
		const prefix = this.props.pluginId ? `[PluginErrorBoundary:${this.props.pluginId}]` : '[PluginErrorBoundary]';
		console.error(`${prefix} A React component crashed:`, error);
		if (componentStack) {
			console.error(`${prefix} Component stack:`, componentStack);
		}
	}

	private _handleRetry = (): void => {
		this.setState({ error: null, componentStack: null });
	};

	override render(): ReactNode {
		const { error, componentStack } = this.state;
		if (!error) {
			return this.props.children;
		}

		const { fallback, pluginId } = this.props;
		const errorInfo: PluginErrorInfo = {
			error,
			componentStack: componentStack ?? undefined,
			pluginId
		};

		// Custom fallback (component or render function)
		if (fallback !== undefined) {
			if (typeof fallback === 'function') {
				return (fallback as (info: PluginErrorInfo, retry: () => void) => ReactNode)(
					errorInfo,
					this._handleRetry
				);
			}
			return fallback;
		}

		// Default fallback
		return React.createElement(DefaultErrorFallback, {
			error,
			pluginId,
			onRetry: this._handleRetry
		});
	}
}

// ─── Default Fallback UI ─────────────────────────────────────

interface DefaultErrorFallbackProps {
	error: Error;
	pluginId?: string;
	onRetry: () => void;
}

const fallbackStyles: Record<string, React.CSSProperties> = {
	container: {
		padding: '16px',
		margin: '8px 0',
		borderRadius: '6px',
		border: '1px solid #e8dadb',
		backgroundColor: '#fdf2f2',
		color: '#6b2c2c',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		fontSize: '13px',
		lineHeight: '1.5'
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: '8px'
	},
	title: {
		fontWeight: 600,
		fontSize: '14px'
	},
	message: {
		color: '#8b4545',
		marginBottom: '8px',
		wordBreak: 'break-word' as const
	},
	button: {
		padding: '4px 12px',
		borderRadius: '4px',
		border: '1px solid #d4a0a0',
		backgroundColor: 'white',
		color: '#6b2c2c',
		cursor: 'pointer',
		fontSize: '12px',
		fontWeight: 500
	}
};

function DefaultErrorFallback({ error, pluginId, onRetry }: DefaultErrorFallbackProps) {
	const label = pluginId ? `Plugin "${pluginId}" encountered an error` : 'A component encountered an error';

	return React.createElement(
		'div',
		{ style: fallbackStyles['container'] },
		React.createElement(
			'div',
			{ style: fallbackStyles['header'] },
			React.createElement('span', { style: fallbackStyles['title'] }, label),
			React.createElement(
				'button',
				{
					style: fallbackStyles['button'],
					onClick: onRetry,
					type: 'button'
				},
				'Retry'
			)
		),
		React.createElement('div', { style: fallbackStyles['message'] }, error.message)
	);
}
