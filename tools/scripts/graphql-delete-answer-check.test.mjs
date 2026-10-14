// node --test tools/scripts/graphql-delete-answer-check.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodyOpen, examine, methodBody } from './graphql-delete-answer-check.mjs';

/** One resolver field, in the shape the resolvers of this repository declare them. */
const field = (signature, body) => `
	@Mutation('deleteThing')
	@Permissions(PermissionsEnum.THINGS_EDIT)
	${signature} {
${body}
	}
`;

const DROPPED = `		await this.thingService.delete(id);

		return true;`;

test('a field that drops the delete result and answers true is reported', () => {
	const { examined, findings } = examine(field(`async deleteThing(@Args('id', { type: () => ID }) id: Id): Promise<boolean>`, DROPPED));

	assert.equal(examined, 1);
	assert.deepEqual(findings.map((f) => f.name), ['deleteThing']);
});

test('the body is found behind an object-shaped return type (Promise<{ … }>, or an object type of its own)', () => {
	for (const signature of [
		`async deleteThing(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }>`,
		`async deleteThing(@Args('id') id: ID): { id: ID; deleted: boolean }`,
		`async deleteThing(@Args('id') id: ID): Promise<{ id: ID } | { error: string }>`,
		`async deleteThing(@Args('id') id: ID): Promise<Array<{ id: ID }>>`
	]) {
		const source = field(signature, DROPPED);

		assert.match(methodBody(source, source.indexOf('@Mutation')).body, /thingService\.delete/, signature);
		assert.equal(examine(source).findings.length, 1, signature);
	}
});

test('the body is found when the return type has an arrow in it', () => {
	const source = field(`async deleteThing(@Args('id') id: ID): Promise<() => { done: boolean }>`, DROPPED);

	assert.equal(examine(source).findings.length, 1);
});

test('the body is found with no return type at all', () => {
	const source = field(`async deleteThing(@Args('id', { type: () => ID }) id: ID)`, DROPPED);
	// Just after the parameter list: the `)` that closes the parameters, not the one inside `@Args(…)`.
	const after = source.indexOf('id: ID)') + 'id: ID)'.length;

	assert.equal(source[bodyOpen(source, after)], '{');
	assert.match(methodBody(source, source.indexOf('@Mutation')).body, /thingService\.delete/);
	assert.equal(examine(source).findings.length, 1);
});

test('a field that consults the result is not reported', () => {
	for (const body of [
		`		return deleteRemovedRows(await this.thingService.delete(id));`,
		`		const result = await this.thingService.delete(id);

		return Number(result?.affected ?? 0) > 0;`,
		`		const userErrors = deleteOutcome(await this.thingService.delete(id), id);

		return { id: userErrors.length ? null : id, userErrors };`
	]) {
		assert.deepEqual(examine(field(`async deleteThing(@Args('id') id: ID): Promise<boolean>`, body)).findings, []);
	}
});

test('a field that reads the row with a raising read first is not reported', () => {
	const body = `		const thing = await this.thingService.findOneByIdString(id);
		await this.thingService.delete(id);

		return true;`;

	assert.deepEqual(examine(field(`async deleteThing(@Args('id') id: ID): Promise<boolean>`, body)).findings, []);
});

test('a delete chained into a .then that ignores its result is reported, and so is a constant payload', () => {
	const then = field(`async deleteThing(@Args('id') id: string): Promise<any>`, `		return await this.service.delete(id).then(() => true);`);
	const payload = field(
		`async deleteThing(@Args('id') id: ID)`,
		`		try {
			await this.thingService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}`
	);

	assert.equal(examine(then).findings.length, 1);
	assert.equal(examine(payload).findings.length, 1);
});

test('a soft removal is not a hard delete', () => {
	const body = `		await this.thingService.softRemove(id);

		return true;`;

	assert.equal(examine(field(`async deleteThing(@Args('id') id: ID): Promise<boolean>`, body)).examined, 0);
});
