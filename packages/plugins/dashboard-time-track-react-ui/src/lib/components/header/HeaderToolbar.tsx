import { useId } from 'react';
import { useTranslation } from '@gauzy/ui-react';
import { NbButton } from '../NbButton';
import { NbIcon } from '../NbIcon';

export interface HeaderToolbarProps {
	autoRefresh: boolean;
	onAutoRefreshChange: (value: boolean) => void;
	/** `logs$.next(true)`. */
	onRefresh: () => void;
}

/**
 * The start of the Angular tab's header action strip: the "Auto Refresh" `nb-toggle` (small,
 * basic) and the outline "Refresh" button, which is disabled while auto-refresh is on.
 */
export function HeaderToolbar({ autoRefresh, onAutoRefreshChange, onRefresh }: HeaderToolbarProps) {
	const { t } = useTranslation();
	const inputId = useId();
	return (
		<div className="gz-rtt-toolbar">
			<label className="gz-rtt-toggle" htmlFor={inputId}>
				<input
					id={inputId}
					className="gz-rtt-toggle-input"
					type="checkbox"
					role="switch"
					checked={autoRefresh}
					aria-checked={autoRefresh}
					onChange={(event) => onAutoRefreshChange(event.target.checked)}
				/>
				<span className={`gz-rtt-toggle-track${autoRefresh ? ' checked' : ''}`} aria-hidden="true">
					<span className="gz-rtt-toggle-switcher" />
				</span>
				<span className="gz-rtt-toggle-text">{t('BUTTONS.AUTO_REFRESH')}</span>
			</label>
			{/* `.gz-rtt-action-label` is hidden at <=36rem, so the button needs an explicit accessible name. */}
			<NbButton
				className="gz-rtt-refresh"
				appearance="outline"
				status="basic"
				size="small"
				disabled={autoRefresh}
				onClick={onRefresh}
				title={t('BUTTONS.REFRESH')}
				aria-label={t('BUTTONS.REFRESH')}
			>
				<NbIcon icon="sync-outline" />
				<span className="gz-rtt-action-label">{t('BUTTONS.REFRESH')}</span>
			</NbButton>
		</div>
	);
}
