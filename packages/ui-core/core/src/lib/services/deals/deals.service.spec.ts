import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DealsService } from './deals.service';

/**
 * Moving a deal on the deals board goes through the same `PUT /deals/:id` as the deal form, with the stage
 * and the deal's scope only, so nothing read earlier (title, probability) is written back over a newer edit.
 */
describe('DealsService.updateStage', () => {
	it('puts only the stage and the scope to the deal', async () => {
		const http = { put: jest.fn(() => of({ affected: 1 })) };
		const service = new DealsService(http as unknown as HttpClient);

		await service.updateStage('deal-1', 'stage-2', { organizationId: 'org-1', tenantId: 'tenant-1' });

		expect(http.put).toHaveBeenCalledTimes(1);
		const [url, body] = http.put.mock.calls[0] as unknown as [string, object];
		expect(url).toMatch(/\/deals\/deal-1$/);
		expect(body).toEqual({ stageId: 'stage-2', organizationId: 'org-1', tenantId: 'tenant-1' });
	});
});
