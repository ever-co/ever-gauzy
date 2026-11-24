// The adapter's requests are the ones Gauzy's own UI makes, so Gauzy's validation takes them (node --test).
import assert from 'node:assert/strict';
import test from 'node:test';
import { taxIdSave } from './adapter.mjs';

test('positive_lookup saves the tax id as the organization form does: with the stored name and currency', () => {
	// PUT /api/organization/:id validates the whole organization (UpdateOrganizationDTO): a body with the
	// tax id alone answers 400 "currency should not be empty", "name should not be empty".
	const stored = { id: 'org-1', name: 'Acme', currency: 'EUR', taxId: null, website: 'https://acme.example' };

	assert.deepEqual(taxIdSave(stored, 'DE 123 456 789'), { name: 'Acme', currency: 'EUR', taxId: 'DE 123 456 789' });
});

test('an organization read without its name or currency is a fault of the run, not a save that answers 400', () => {
	assert.throws(() => taxIdSave({ id: 'org-1', name: 'Acme' }, 'DE 123 456 789'), /name and currency/);
	assert.throws(() => taxIdSave({ id: 'org-1', currency: 'EUR' }, 'DE 123 456 789'), /name and currency/);
	assert.throws(() => taxIdSave(null, 'DE 123 456 789'), /name and currency/);
});
