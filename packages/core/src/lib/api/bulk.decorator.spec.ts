import { PermissionsEnum } from '@gauzy/contracts';
import { BULK_OPERATION_METADATA, BulkOperation, bulkOptionsOf, readBulkOperation } from './bulk.decorator';

/**
 * Reading a route's bulk declaration back.
 *
 * `@BulkOperation` records what a batch accepts — its resource name, its cap and the one permission the
 * whole request is authorised against — and the executor is configured from that record rather than
 * from a second copy in the controller body. So the record has to be readable, and it was not: the
 * decorator is `SetMetadata`, which writes a method's metadata onto the method function, while the
 * reader asked for metadata *defined with an explicit property key* on the prototype. That slot is
 * empty, so every correctly decorated route was reported as declaring nothing. Nothing caught it
 * because no route in this repository used the machinery until one did — which is the case these
 * assertions exist to keep.
 */
describe('the bulk operation declaration', () => {
	describe('reading it back', () => {
		class Declared {
			@BulkOperation({ resource: 'variant', maxItems: 50, permission: PermissionsEnum.PRODUCTS_EDIT })
			async bulk(): Promise<void> {
				return undefined;
			}

			async ordinary(): Promise<void> {
				return undefined;
			}
		}

		it('finds the declaration a method decorator wrote', () => {
			// The control is the shape the decorator actually produces: if the reader looked in the wrong
			// slot this is `undefined`, and every decorated route reads as undecorated.
			expect(readBulkOperation(Declared.prototype, 'bulk')).toEqual({
				resource: 'variant',
				maxItems: 50,
				permission: PermissionsEnum.PRODUCTS_EDIT
			});
		});

		it('answers nothing for a route that accepts no batch', () => {
			expect(readBulkOperation(Declared.prototype, 'ordinary')).toBeUndefined();
			expect(readBulkOperation(Declared.prototype, 'doesNotExist')).toBeUndefined();
		});

		it('resolves the executor options the route declared', () => {
			const options = bulkOptionsOf(Declared, 'bulk', { requiredKeys: ['id'] });

			// The declaration supplies the resource, the cap and the permission; the call site supplies
			// only what a declaration cannot carry, and it wins where the two overlap.
			expect(options).toEqual({
				resource: 'variant',
				cap: 50,
				permission: PermissionsEnum.PRODUCTS_EDIT,
				requiredKeys: ['id']
			});
		});

		it('refuses a route that accepts a batch and declares none', () => {
			// A programming mistake rather than a request-level failure, and it must be loud: a batch run
			// without a declared resource names its items in no error a client can act on.
			expect(() => bulkOptionsOf(Declared, 'ordinary')).toThrow(/declares no @BulkOperation/);
		});
	});

	describe('the two levels', () => {
		@BulkOperation({ resource: 'product' })
		class AtTheController {
			async bulk(): Promise<void> {
				return undefined;
			}
		}

		class Narrowed extends AtTheController {
			@BulkOperation({ resource: 'product', maxItems: 10 })
			override async bulk(): Promise<void> {
				return undefined;
			}
		}

		it('reads a controller-level declaration for a route that states none of its own', () => {
			expect(readBulkOperation(AtTheController.prototype, 'bulk')).toEqual({ resource: 'product' });
		});

		it('lets a route narrow what its controller declared', () => {
			// The narrower declaration wins rather than merging: half of one and half of the other would be
			// a cap from one place and a permission from another, which is how a batch ends up authorised
			// against a permission nobody chose.
			expect(readBulkOperation(Narrowed.prototype, 'bulk')).toEqual({ resource: 'product', maxItems: 10 });
		});

		it('reads the controller when no method is named', () => {
			expect(readBulkOperation(AtTheController.prototype)).toEqual({ resource: 'product' });
		});

		it('answers nothing when there is no target at all', () => {
			expect(readBulkOperation(undefined as unknown as object, 'bulk')).toBeUndefined();
		});
	});

	it('keeps the metadata key stable, because a route declaration is read from outside the route', () => {
		// The key is the contract between the decorator and the executor's configurator; a literal that
		// drifted names a slot nothing writes to.
		expect(BULK_OPERATION_METADATA).toBe('api:bulk-operation');
	});
});
