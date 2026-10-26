import * as express from 'express';
import { memoizeRequestQuery } from './request-query-memo';

describe('memoizeRequestQuery', () => {
	it('parses the query once per request, reparses after a URL rewrite, and accepts assignment', () => {
		const app = express();
		app.set('query parser', 'extended');
		let parses = 0;
		const parser = app.get('query parser fn');
		app.set('query parser fn', (value: string) => {
			parses++;
			return parser(value);
		});
		expect(memoizeRequestQuery(app)).toBe(true);

		const req: any = Object.create(app.request);
		req.url = '/api/tags?where[organizationId]=o1&take=10';
		expect(req.query).toEqual({ where: { organizationId: 'o1' }, take: '10' });
		expect(req.query).toBe(req.query);
		expect(parses).toBe(1);

		req.url = '/tags?where[organizationId]=o1&take=10';
		expect(req.query.take).toBe('10');
		expect(parses).toBe(2);

		req.query = { custom: true };
		expect(req.query).toEqual({ custom: true });
		expect(parses).toBe(2);

		// A second request does not see the first one's memo.
		const other: any = Object.create(app.request);
		other.url = '/x?a=1';
		expect(other.query).toEqual({ a: '1' });
	});
});
