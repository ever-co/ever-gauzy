import { IOrganizationStrategicSignals } from '@gauzy/contracts';

/**
 * The signals document of an initiative as an object. SQLite stores it as text, so a read can answer a JSON
 * string; a malformed one reads as no signals rather than failing the page.
 */
export function parseInitiativeSignals(
	signals: IOrganizationStrategicSignals | string | null | undefined
): IOrganizationStrategicSignals {
	if (!signals) {
		return {};
	}
	if (typeof signals === 'string') {
		try {
			const parsed = JSON.parse(signals);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}
	return signals;
}
