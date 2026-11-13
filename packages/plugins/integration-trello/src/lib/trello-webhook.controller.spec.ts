// cspell:ignore cret — the test secret `s3cret`
import { createHmac } from 'node:crypto';
import { cardIdOf, isTrelloSignatureValid } from './trello-webhook.controller';

describe('Trello webhook checks', () => {
	const secret = 's3cret';
	const callback = 'https://api.example.com/api/integration/trello/webhook/m-1';
	const body = Buffer.from('{"action":{"type":"updateCard"}}');
	const sign = (data: Buffer, url: string, key = secret) => createHmac('sha1', key).update(Buffer.concat([data, Buffer.from(url)])).digest('base64');

	it('accepts the base64 HMAC-SHA1 of the raw body and the callback URL', () => {
		expect(isTrelloSignatureValid(secret, body, callback, sign(body, callback))).toBe(true);
	});

	it('refuses a missing, malformed, foreign, tampered or differently addressed signature', () => {
		expect(isTrelloSignatureValid(secret, body, callback, undefined)).toBe(false);
		expect(isTrelloSignatureValid(secret, body, callback, 'not base64!')).toBe(false);
		expect(isTrelloSignatureValid(secret, body, callback, sign(body, callback, 'other'))).toBe(false);
		expect(isTrelloSignatureValid(secret, Buffer.from('{"action":{}}'), callback, sign(body, callback))).toBe(false);
		expect(isTrelloSignatureValid(secret, body, 'https://api.example.com/other', sign(body, callback))).toBe(false);
	});

	it('names the card of an action worth reading again, never a deleted or unrelated one', () => {
		const id = '5f1a2b3c4d5e6f7a8b9c0d1e';
		expect(cardIdOf({ type: 'updateCard', data: { card: { id } } })).toBe(id);
		expect(cardIdOf({ type: 'createCard', data: { card: { id } } })).toBe(id);
		expect(cardIdOf({ type: 'updateComment', data: { card: { id } } })).toBe(id);
		expect(cardIdOf({ type: 'deleteCard', data: { card: { id } } })).toBeNull();
		expect(cardIdOf({ type: 'updateList', data: { list: { id } } })).toBeNull();
		expect(cardIdOf({ type: 'updateCard', data: { card: { id: 'nope' } } })).toBeNull();
		expect(cardIdOf(undefined)).toBeNull();
	});
});
