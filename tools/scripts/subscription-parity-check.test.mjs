/**
 * The readers of `subscription-parity-check.mjs`, held to every shape they must read.
 *
 * A gate's reader that silently skips a shape is a gate that stops measuring without going red, so each shape a
 * producer or a catalogue may legitimately take is a case here (Greptile, #10556: a commented-out publish counted as
 * a producer; a double-quoted or `as const` catalogue was not read at all).
 *
 * Run from the repository root: `node --test tools/scripts/subscription-parity-check.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	findSilentStreams,
	readServedSubscriptions,
	readStreamedCatalogues,
	stripComments
} from './subscription-parity-check.mjs';

const RESOLVER = `
import { WidgetChangedEvent } from './widget.events';
@Resolver()
export class WidgetResolver {
	@Subscription('widgetChanged', { resolve: deliverPayloadAsIs })
	widgetChanged() {
		return tenantScopedEventStream(this.eventBus.ofType(WidgetChangedEvent), {});
	}
}`;

const silentWith = (producer) =>
	findSilentStreams(new Map([['widget.resolver.ts', RESOLVER], ['widget.service.ts', producer]]));

test('a stream whose event is published is not silent, in each producer shape', () => {
	assert.deepEqual(silentWith('await this.eventBus.publish(WidgetChangedEvent.from(row));'), []);
	assert.deepEqual(silentWith('this.eventBus.publish(new WidgetChangedEvent(row.id, row.tenantId));'), []);
	assert.deepEqual(silentWith('const event = WidgetChangedEvent.from(row);\nawait this.eventBus.publish(event);'), []);
	// A conditional argument: the catalog publishes one of two events from one call.
	assert.deepEqual(
		silentWith('await this.eventBus.publish(\n\tactive\n\t\t? WidgetChangedEvent.from(row)\n\t\t: OtherEvent.from(row)\n);'),
		[]
	);
});

test('a commented-out publish is not a producer', () => {
	assert.equal(silentWith('// await this.eventBus.publish(WidgetChangedEvent.from(row));').length, 1);
	assert.equal(silentWith('/* this.eventBus.publish(new WidgetChangedEvent(row.id)); */').length, 1);
	assert.equal(silentWith('/**\n * eventBus.publish(WidgetChangedEvent.from(row)) — in a doc comment\n */').length, 1);
});

test('constructing the event without publishing it is not a producer', () => {
	assert.equal(silentWith('const event = WidgetChangedEvent.from(row);\nreturn event;').length, 1);
	assert.equal(silentWith('this.eventBus.publish(other);\nconst unused = new WidgetChangedEvent(row.id);').length, 1);
});

test('the resolver itself is never its own producer', () => {
	const resolverPublishing = RESOLVER + '\nthis.eventBus.publish(WidgetChangedEvent.from(row));';
	assert.equal(findSilentStreams(new Map([['widget.resolver.ts', resolverPublishing]])).length, 1);
});

test('comments are stripped but strings are kept, a URL included', () => {
	assert.equal(stripComments("const url = 'http://example.test'; // tail"), "const url = 'http://example.test'; \n");
	assert.equal(stripComments('a /* b */ c'), 'a         c');
});

test('a catalogue is read in every quote style, with or without a type and with `as const`', () => {
	const { names, unreadable } = readStreamedCatalogues(
		new Map([
			['a.ts', "export const A_STREAMED_EVENTS: readonly string[] = ['a.created', 'a.deleted'];"],
			['b.ts', 'export const B_STREAMED_EVENTS = ["b.created"] as const;'],
			['c.ts', 'export const C_STREAMED_EVENTS = [`c.created`];'],
			['d.ts', "// export const D_STREAMED_EVENTS = ['d.created'];"]
		])
	);
	assert.deepEqual(
		names.map((entry) => entry.name),
		['a.created', 'a.deleted', 'b.created', 'c.created']
	);
	assert.deepEqual(unreadable, []);
});

test('a declaration the reader cannot resolve is reported, never skipped', () => {
	const { names, unreadable } = readStreamedCatalogues(
		new Map([
			['a.ts', "export const A_STREAMED_EVENTS = ['a.created'];\ndeclareStreamedEvents(this.catalogue, this.consumer, ...A_STREAMED_EVENTS);"],
			['b.ts', "declareStreamedEvents(this.catalogue, this.consumer, 'b.literal', ...SOMEWHERE_ELSE);"]
		])
	);
	assert.deepEqual(names.map((entry) => entry.name).sort(), ['a.created', 'b.literal']);
	assert.equal(unreadable.length, 1);
	assert.match(unreadable[0], /SOMEWHERE_ELSE/);
});

test('a description is never read as a Subscription field', () => {
	const sdl = [
		'type Subscription {',
		'  """',
		'  A stream. A subscription is never a system of',
		'  record: it is a notification.',
		'  """',
		'  events(names: [String!]!): JSON!',
		'  "A one-line description: not a field"',
		'  widgetChanged(id: ID): Widget!',
		'}'
	].join('\n');
	assert.deepEqual(readServedSubscriptions(sdl), ['events', 'widgetChanged']);
});
