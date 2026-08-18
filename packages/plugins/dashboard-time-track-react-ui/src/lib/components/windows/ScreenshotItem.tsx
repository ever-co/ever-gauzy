import { useCallback, useMemo, type MouseEvent } from 'react';
import { NbDialogService } from '@nebular/theme';
import { filter, take } from 'rxjs/operators';
import { ID, IOrganization, IScreenshot, ITimeLog, ITimeSlot, TimeFormatEnum } from '@gauzy/contracts';
import { DEFAULT_SVG } from '@gauzy/ui-core/common';
import { ErrorHandlingService, TimesheetService, ToastrService } from '@gauzy/ui-core/core';
import { ConfirmComponent, GalleryComponent, GalleryService, ViewScreenshotsModalComponent } from '@gauzy/ui-core/shared';
import { useInjector, useTranslation } from '@gauzy/ui-react';
import { ProgressBar, progressStatus } from '@gauzy/ui-react-components';
import { dateFormat, durationMinutesLabel, timeFormat as formatTime, utcToTimezone } from '../../utils/format.utils';
import { NbButton } from '../NbButton';
import { NbIcon } from '../NbIcon';

export interface ScreenshotItemProps {
	timeSlot: ITimeSlot;
	/** IANA zone the times are rendered in (`[timezone]`). */
	timeZone: string;
	/** 12/24 (`[timeFormat]`). */
	timeFormat: TimeFormatEnum;
	/** Owner of the slot; the gallery filters its strip by it (`[employeeId]`). */
	employeeId?: ID;
	/** The organization the slot belongs to (for the delete request + toast). */
	organization: IOrganization | null | undefined;
	/** Organization date format / locale for the caption date. */
	dateFormatOptions: { dateFormat?: string | null; locale?: string | null };
	/** Fired after a slot was deleted (from the trash button or the info modal). */
	onDelete: (ids: ID[]) => void;
}

/**
 * Prepares a slot exactly like the `ScreenshotsItemComponent.timeSlot` setter: screenshots
 * stamped with the slot's `employeeId`, the danger border when every screenshot is flagged not
 * work-related, `isAllowDelete` when no log is running, and the newest screenshot as thumbnail.
 *
 * @param timeSlot Raw slot from the statistics endpoint.
 */
export function prepareTimeSlot(timeSlot: ITimeSlot): {
	slot: ITimeSlot;
	screenshots: IScreenshot[];
	lastScreenshot: IScreenshot | null;
	isShowBorder: boolean;
} {
	const screenshots: IScreenshot[] = (JSON.parse(JSON.stringify(timeSlot.screenshots || [])) as IScreenshot[]).map(
		(screenshot) => ({ employeeId: timeSlot.employeeId, ...screenshot })
	);
	const isShowBorder = screenshots.length > 0 && screenshots.every((screenshot) => screenshot.isWorkRelated === false);
	const isAllowDelete = (timeSlot.timeLogs || []).every((log: ITimeLog) => !log.isRunning);
	const sorted = [...screenshots].sort((a, b) => String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? ''))).reverse();
	return {
		slot: { ...timeSlot, isAllowDelete, screenshots },
		screenshots,
		lastScreenshot: sorted.length > 0 ? sorted[0] : null,
		isShowBorder
	};
}

/** The Angular template stops every action click so it never reaches the slot card. */
const stop = (event: MouseEvent) => event.stopPropagation();

/**
 * React port of `<ngx-screenshots-item [multiple]="false">`: thumbnail with the hover actions
 * (delete with confirm, description info, View Screen → the shared Angular gallery dialog, View
 * Info → the Angular screenshots modal) and the slot info block (time range in the selected
 * zone/format, date caption, activity bar, "x% of mm Minutes").
 *
 * The dialogs and services are the Angular ones, obtained through the injector, so the gallery,
 * the delete request, the toast and the error handling are byte-identical to the Angular tab.
 */
export function ScreenshotItem({ timeSlot, timeZone, timeFormat, employeeId, organization, dateFormatOptions, onDelete }: ScreenshotItemProps) {
	const { t } = useTranslation();
	const injector = useInjector();
	const dialogService = useMemo(() => injector.get(NbDialogService), [injector]);
	const timesheetService = useMemo(() => injector.get(TimesheetService), [injector]);
	const galleryService = useMemo(() => injector.get(GalleryService), [injector]);
	const toastrService = useMemo(() => injector.get(ToastrService), [injector]);
	const errorHandlingService = useMemo(() => injector.get(ErrorHandlingService), [injector]);

	const { slot, screenshots, lastScreenshot, isShowBorder } = useMemo(() => prepareTimeSlot(timeSlot), [timeSlot]);

	/** `ngxGallery` click: open the shared gallery on the newest screenshot. */
	const viewScreen = useCallback(
		(event: MouseEvent) => {
			stop(event);
			if (!lastScreenshot) return;
			const item = JSON.parse(JSON.stringify(lastScreenshot));
			dialogService.open(GalleryComponent, { context: { item, employeeId }, dialogClass: 'fullscreen' });
		},
		[dialogService, lastScreenshot, employeeId]
	);

	/** `viewInfo(timeSlot)`: the Angular screenshots modal; a delete inside it bubbles up. */
	const viewInfo = useCallback(
		(event: MouseEvent) => {
			stop(event);
			const dialog = dialogService.open(ViewScreenshotsModalComponent, {
				context: { timeSlot: slot, timeLogs: slot.timeLogs }
			});
			dialog.onClose
				.pipe(
					filter((data) => Boolean(data && data['isDelete'])),
					take(1)
				)
				.subscribe(() => onDelete([slot.id]));
		},
		[dialogService, slot, onDelete]
	);

	/** `deleteSlot(timeSlot)` behind the `ngxConfirmDialog`. */
	const deleteSlot = useCallback(
		async (event: MouseEvent) => {
			stop(event);
			if (!slot.isAllowDelete || !organization) return;
			const dialog = dialogService.open(ConfirmComponent, {
				dialogClass: 'modal-sm',
				context: { data: { message: t('ACTIVITY.DELETE_CONFIRM') } }
			});
			dialog.onClose.pipe(take(1)).subscribe(async (confirmed) => {
				if (!confirmed) return;
				try {
					const { id: organizationId, tenantId } = organization;
					const ids = [slot.id];
					await timesheetService.deleteTimeSlots({ ids, organizationId, tenantId });
					galleryService.removeGalleryItems(
						(slot.screenshots || []).map((screenshot) => ({
							thumbUrl: screenshot.thumbUrl,
							fullUrl: screenshot.fullUrl,
							...screenshot
						}))
					);
					const employeeName = slot.employee?.fullName?.trim() || 'Unknown Employee';
					toastrService.success('TOASTR.MESSAGE.SCREENSHOT_DELETED', {
						name: employeeName,
						organization: organization.name
					});
					onDelete(ids);
				} catch (error) {
					console.log('Error while deleting time slot', error);
					errorHandlingService.handleError(error);
				}
			});
		},
		[dialogService, slot, organization, t, timesheetService, galleryService, toastrService, errorHandlingService, onDelete]
	);

	const startedAt = utcToTimezone(slot.startedAt, timeZone);
	const stoppedAt = slot.stoppedAt ? utcToTimezone(slot.stoppedAt, timeZone) : '';
	const percentage = slot.percentage || 0;

	return (
		<div className={`gz-rtt-shot${isShowBorder ? ' danger-bordered' : ''}`}>
			<div className="gz-rtt-shot-activity">
				<div className="gz-rtt-shot-image">
					<div className="gz-rtt-shot-hover">
						<div className="gz-rtt-shot-actions">
							{slot.isAllowDelete ? (
								<NbButton className="gz-rtt-ml-auto" status="danger" size="tiny" iconOnly onClick={deleteSlot} title={t('BUTTONS.DELETE')}>
									<NbIcon icon="trash-2-outline" />
								</NbButton>
							) : null}
							{lastScreenshot?.description ? (
								<NbButton className="gz-rtt-ml-2" status="info" size="tiny" iconOnly title={lastScreenshot.description} onClick={stop}>
									<NbIcon icon="info-outline" />
								</NbButton>
							) : null}
						</div>
						<div className="gz-rtt-shot-view">
							{screenshots.length > 0 ? (
								<NbButton size="small" status="primary" onClick={viewScreen}>
									{t('ACTIVITY.VIEW_SCREEN')}
								</NbButton>
							) : null}
							<NbButton size="small" status="basic" onClick={viewInfo}>
								{t('ACTIVITY.VIEW_INFO')}
							</NbButton>
						</div>
					</div>
					{lastScreenshot ? (
						<img draggable={false} src={lastScreenshot.thumbUrl} alt="" />
					) : (
						<>
							<img draggable={false} src={DEFAULT_SVG} className="default-image" alt="" />
							<span className="gz-rtt-no-image">{t('ACTIVITY.NO_SCREENSHOT')}</span>
						</>
					)}
				</div>
				<div className="gz-rtt-slot-info">
					<div className="gz-rtt-time-span gz-rtt-hour-label">
						<div className="gz-rtt-inline-time-span">
							{formatTime(startedAt, timeFormat)} - {stoppedAt ? formatTime(stoppedAt, timeFormat) : ''}
						</div>
						<div className="gz-rtt-caption">{dateFormat(startedAt, dateFormatOptions)}</div>
					</div>
					<ProgressBar className="gz-rtt-shot-progress gz-rtt-mb-1" value={percentage} status={progressStatus(percentage)} height="10px" />
					<div className="gz-rtt-activity-count gz-rtt-hour-label">
						{percentage}% of {durationMinutesLabel(slot.duration)} {t('ACTIVITY.MINUTES')}
					</div>
				</div>
			</div>
		</div>
	);
}
