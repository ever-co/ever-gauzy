import { useState } from 'react';
import { TimeFormatEnum, TimeZoneEnum } from '@gauzy/contracts';
import { useTranslation } from '@gauzy/ui-react';
import { Popover } from '@gauzy/ui-react-components';
import { useTimezoneFilter } from '../../hooks/use-timezone-filter';
import { NbButton } from '../NbButton';
import { NbIcon } from '../NbIcon';

export interface TimezoneFilterProps {
	/** Show the zone section (Angular `[isTimezone]`). */
	isTimezone?: boolean;
	/** Show the format section (Angular `[isTimeFormat]`). */
	isTimeFormat?: boolean;
}

/**
 * React port of `<ga-timezone-filter>`: the "BST: Europe - Isle of Man / 12 hour ⋮" button and
 * its popover with the Time Zone (UTC / Org / Mine) and Time Format (12 / 24 hour) lists. Picking
 * an entry applies it through `TimeZoneService`, persists it as a query param and closes the
 * popover — see {@link useTimezoneFilter} for the semantics.
 */
export function TimezoneFilter({ isTimezone = true, isTimeFormat = true }: TimezoneFilterProps) {
	const { t } = useTranslation();
	const filter = useTimezoneFilter();
	const [open, setOpen] = useState(false);

	const pickZone = async (zone: TimeZoneEnum) => {
		setOpen(false);
		await filter.updateSelectedTimeZone(zone);
	};
	const pickFormat = async (format: number) => {
		setOpen(false);
		await filter.updateSelectedTimeFormat(format as TimeFormatEnum);
	};

	return (
		<Popover
			open={open}
			onOpenChange={setOpen}
			placement="bottom"
			content={
				<div className="gz-rtt-popover-body">
					{isTimezone ? (
						<div className="gz-rtt-category">
							<div className="gz-rtt-view">{t('TIMESHEET.TIME_ZONE')}</div>
							{filter.timeZoneOptions.map((option) => (
								<button type="button" key={option.value} className="gz-rtt-title" onClick={() => void pickZone(option.value)}>
									<i className="fas fa-check" style={{ visibility: filter.selectedTimeZone === option.value ? 'visible' : 'hidden' }} />
									<div>{t(option.labelKey)}</div>
								</button>
							))}
						</div>
					) : null}
					{isTimezone && isTimeFormat ? <div className="gz-rtt-line" /> : null}
					{isTimeFormat ? (
						<div className="gz-rtt-category">
							<div className="gz-rtt-view">{t('TIMESHEET.TIME_FORMAT')}</div>
							{filter.timeFormatOptions.map((option) => (
								<button type="button" key={option} className="gz-rtt-title" onClick={() => void pickFormat(option)}>
									<i className="fas fa-check" style={{ visibility: filter.selectedTimeFormat === option ? 'visible' : 'hidden' }} />
									<div>{option} hour</div>
								</button>
							))}
						</div>
					) : null}
				</div>
			}
		>
			<NbButton className="gz-rtt-popover-button" size="small" status="basic" aria-haspopup="dialog" aria-expanded={open}>
				<div>
					{isTimezone ? filter.timeZoneLabel : null}
					{isTimeFormat ? ` / ${filter.selectedTimeFormat} hour` : null}
				</div>
				<NbIcon icon="more-vertical-outline" />
			</NbButton>
		</Popover>
	);
}
