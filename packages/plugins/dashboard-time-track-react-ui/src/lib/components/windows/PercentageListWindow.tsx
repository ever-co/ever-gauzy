import '../nebular-jsx';
import { type ReactNode } from 'react';
import { ProgressBar, progressStatus } from '@gauzy/ui-react-components';
import { durationFormat } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { WindowCard } from './WindowCard';

/** One row of the Tasks / Projects windows. */
export interface PercentageListRow {
	id: string;
	name: ReactNode;
	durationPercentage: number | undefined;
	duration: number | undefined;
}

export interface PercentageListWindowProps {
	title: string;
	rows: PercentageListRow[];
	loading: boolean;
	emptyMessage: string;
	/** Optional "View All" header button (the Tasks window has one, Projects does not). */
	action?: { label: string; onClick: () => void };
	/** Extra class on the `nb-list` (`projects-list`). */
	listClassName?: string;
}

/**
 * The Tasks (`gaWindowTemplate` #2) and Projects (#3) windows: name, `x%` + tiny progress bar,
 * duration — the same `.data-list` row both Angular templates render.
 */
export function PercentageListWindow({ title, rows, loading, emptyMessage, action, listClassName }: PercentageListWindowProps) {
	return (
		<WindowCard
			title={title}
			loading={loading}
			hasData={rows.length > 0}
			emptyMessage={emptyMessage}
			action={
				action ? (
					<NbButton appearance="outline" status="primary" size="small" onClick={action.onClick}>
						{action.label}
					</NbButton>
				) : null
			}
		>
			<nb-list className={`gz-rtt-data-list${listClassName ? ` ${listClassName}` : ''}`}>
				{rows.map((row) => {
					const percentage = row.durationPercentage ?? 0;
					return (
						<nb-list-item key={row.id}>
							<div className="gz-rtt-w-100">
								<div className="gz-rtt-row gz-rtt-align-items-center">
									<div
										className="gz-rtt-col-5 gz-rtt-cell gz-rtt-project-name"
										title={typeof row.name === 'string' ? row.name : undefined}
									>
										{row.name}
									</div>
									<div className="gz-rtt-col-4 gz-rtt-cell">
										<div className="gz-rtt-progress-cell">
											<span className="gz-rtt-progress-cell-value">{percentage}%</span>
											<ProgressBar className="gz-rtt-custom-progress" value={percentage} status={progressStatus(percentage)} height="5px" />
										</div>
									</div>
									<div className="gz-rtt-col gz-rtt-cell gz-rtt-cell-numeric">{durationFormat(row.duration)}</div>
								</div>
							</div>
						</nb-list-item>
					);
				})}
			</nb-list>
		</WindowCard>
	);
}
