import { AppError } from '../../error-handler';
import { IKbMouseActivityService } from '../../interfaces';
import { KbMouseActivityDAO } from '../dao';
import { KbMouseActivityTO } from '../dto';
import { KbMouseActivity } from '../models';

export class KbMouseActivityService implements IKbMouseActivityService<KbMouseActivityTO> {
	private _kbMouseDAO: KbMouseActivityDAO;

	constructor() {
		this._kbMouseDAO = new KbMouseActivityDAO();
	}

	public async save(activities: KbMouseActivityTO): Promise<void> {
		try {
			if (!activities) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot save');
			}
			await this._kbMouseDAO.save(activities);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async update(activities: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			if (!activities.id) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot update');
			}
			await this._kbMouseDAO.update(activities.id, activities);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}

	public async retrieve(remoteId: string, organizationId: string, tenantId: string): Promise<KbMouseActivityTO> {
		try {
			const activitiesDao = await this._kbMouseDAO.current(remoteId, organizationId, tenantId);
			if (activitiesDao) {
				const activities = new KbMouseActivity(activitiesDao);
				return activities;
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(activity: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			await this._kbMouseDAO.delete(activity);
		} catch (error) {
			throw new AppError('KB_MOUSE_SERVICE', error);
		}
	}
}
