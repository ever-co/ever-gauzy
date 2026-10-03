// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/schema.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * A JSON Schema (2020-12) checker for the keywords the contract schemas use: `type`,
 * `properties`, `required`, `additionalProperties`, `propertyNames`, `minProperties` and
 * `maxProperties`, `enum`, `const`, `pattern`, `minLength` and `maxLength`, `minimum` and
 * `maximum`, `items`, `minItems` and `maxItems`, `uniqueItems`, `oneOf`, `anyOf`, `allOf`,
 * `if`/`then`/`else` and `$ref` into the same document. Annotations (`format`, `description`,
 * `title`, `$id`) are ignored, as the specification says. It answers every violation with its
 * JSON pointer and a kind, never with the value checked, so a refusal can be logged. The Rust crate
 * carries the same checker, so both languages give a document the same answer.
 */

const ENCODER = new TextEncoder();

/** What kind of rule a value broke. */
export type SchemaKind = 'unknown_field' | 'type' | 'pattern' | 'range' | 'required' | 'shape';

/** One reason a value does not validate. */
export interface SchemaViolation {
  /** The JSON pointer of the value (`""`: the value itself). */
  path: string;
  kind: SchemaKind;
  /** A sentence that never repeats the value. */
  message: string;
}

const pointerSegment = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const child = (path: string, key: string | number) => `${path}/${pointerSegment(String(key))}`;

export const isObject = (v: unknown): v is { [key: string]: unknown } => v !== null && typeof v === 'object' && !Array.isArray(v);

function typeMatches(expected: unknown, v: unknown): boolean {
  switch (expected) {
    case 'object':
      return isObject(v);
    case 'array':
      return Array.isArray(v);
    case 'string':
      return typeof v === 'string';
    case 'boolean':
      return typeof v === 'boolean';
    case 'null':
      return v === null;
    case 'number':
      return typeof v === 'number';
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    default:
      return false;
  }
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (isObject(a)) {
    if (!isObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
  }
  return false;
}

/** Byte order of the UTF-8 form, how the platform orders keys and errors. */
export function byteOrder(a: string, b: string): number {
  const x = ENCODER.encode(a);
  const y = ENCODER.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i += 1) if (x[i] !== y[i]) return (x[i] as number) - (y[i] as number);
  return x.length - y.length;
}

const REGEX = new Map<string, RegExp>();
function regex(pattern: string): RegExp {
  let r = REGEX.get(pattern);
  if (!r) {
    r = new RegExp(pattern, 'u');
    REGEX.set(pattern, r);
  }
  return r;
}

const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);

export class SchemaChecker {
  constructor(private readonly root: { readonly [key: string]: unknown }) {}

  private resolve(ref: string): unknown {
    const [doc, fragment = ''] = ref.split('#');
    if (doc !== '') return undefined;
    let node: unknown = this.root;
    for (const raw of fragment.split('/').slice(1)) {
      if (!isObject(node)) return undefined;
      node = node[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return node;
  }

  fails(schema: unknown, v: unknown): boolean {
    const scratch: SchemaViolation[] = [];
    this.check(schema, v, '', scratch);
    return scratch.length > 0;
  }

  check(schema: unknown, v: unknown, at: string, out: SchemaViolation[]): void {
    if (!isObject(schema)) {
      if (schema === false) out.push({ path: at, kind: 'unknown_field', message: 'no value is allowed here' });
      return;
    }
    if (typeof schema.$ref === 'string') {
      const target = this.resolve(schema.$ref);
      if (target === undefined) out.push({ path: at, kind: 'shape', message: 'unresolvable reference' });
      else this.check(target, v, at, out);
    }
    const push = (kind: SchemaKind, message: string) => out.push({ path: at, kind, message });
    if (typeof schema.type === 'string' && !typeMatches(schema.type, v)) {
      push('type', `expected ${schema.type}`);
      return;
    }
    if (Array.isArray(schema.type) && !schema.type.some((t) => typeMatches(t, v))) {
      push('type', 'matches none of the allowed types');
      return;
    }
    if (Array.isArray(schema.enum) && !schema.enum.some((e) => equal(e, v))) push('pattern', 'not one of the allowed values');
    if (Object.hasOwn(schema, 'const') && !equal(schema.const, v)) push('pattern', 'not the required constant');
    if (typeof v === 'string') {
      const length = [...v].length;
      const max = int(schema.maxLength);
      const min = int(schema.minLength);
      if (max !== undefined && length > max) push('pattern', `longer than ${max} characters`);
      if (min !== undefined && length < min) push('pattern', `shorter than ${min} characters`);
      if (typeof schema.pattern === 'string' && !regex(schema.pattern).test(v)) push('pattern', 'does not match the pattern');
    }
    if (typeof v === 'number') {
      if (typeof schema.minimum === 'number' && v < schema.minimum) push('range', `below the minimum ${schema.minimum}`);
      if (typeof schema.maximum === 'number' && v > schema.maximum) push('range', `above the maximum ${schema.maximum}`);
    }
    if (Array.isArray(v)) {
      const max = int(schema.maxItems);
      const min = int(schema.minItems);
      if (max !== undefined && v.length > max) push('range', `more than ${max} items`);
      if (min !== undefined && v.length < min) push('range', `fewer than ${min} items`);
      if (schema.uniqueItems === true && v.some((item, i) => v.slice(0, i).some((prev) => equal(prev, item))))
        push('range', 'items are not unique');
      if (schema.items !== undefined) v.forEach((item, i) => this.check(schema.items, item, child(at, i), out));
    }
    if (isObject(v)) this.checkObject(schema, v, at, out);
    if (Array.isArray(schema.allOf)) for (const sub of schema.allOf) this.check(sub, v, at, out);
    if (Array.isArray(schema.anyOf) && schema.anyOf.every((sub) => this.fails(sub, v))) push('shape', 'matches none of anyOf');
    if (Array.isArray(schema.oneOf)) {
      const matching = schema.oneOf.filter((sub) => !this.fails(sub, v)).length;
      if (matching !== 1) push('shape', `matches ${matching} of oneOf, not exactly one`);
    }
    if (schema.if !== undefined) {
      const branch = this.fails(schema.if, v) ? schema.else : schema.then;
      if (branch !== undefined) this.check(branch, v, at, out);
    }
  }

  private checkObject(schema: { [key: string]: unknown }, fields: { [key: string]: unknown }, at: string, out: SchemaViolation[]): void {
    const keys = Object.keys(fields).sort(byteOrder);
    const maxProperties = int(schema.maxProperties);
    const minProperties = int(schema.minProperties);
    if (maxProperties !== undefined && keys.length > maxProperties)
      out.push({ path: at, kind: 'range', message: `more than ${maxProperties} properties` });
    if (minProperties !== undefined && keys.length < minProperties)
      out.push({ path: at, kind: 'range', message: `fewer than ${minProperties} properties` });
    if (Array.isArray(schema.required))
      for (const name of schema.required)
        if (typeof name === 'string' && !Object.hasOwn(fields, name))
          out.push({ path: child(at, name), kind: 'required', message: 'required' });
    const properties = isObject(schema.properties) ? schema.properties : null;
    for (const name of keys) {
      const here = child(at, name);
      if (schema.propertyNames !== undefined && this.fails(schema.propertyNames, name)) {
        out.push({ path: here, kind: 'unknown_field', message: 'this key is not allowed here' });
        continue;
      }
      if (properties && Object.hasOwn(properties, name)) this.check(properties[name], fields[name], here, out);
      else if (schema.additionalProperties === false)
        out.push({ path: here, kind: 'unknown_field', message: 'not allowed (the object is closed)' });
      else if (isObject(schema.additionalProperties)) this.check(schema.additionalProperties, fields[name], here, out);
    }
  }
}

/** Every violation of `value` against `schema` (by default the whole document `root`), sorted by path and kind. */
export function schemaViolations(root: { readonly [key: string]: unknown }, value: unknown, schema: unknown = root): SchemaViolation[] {
  const out: SchemaViolation[] = [];
  new SchemaChecker(root).check(schema, value, '', out);
  const seen = new Set<string>();
  return out
    .filter((v) => {
      const key = `${v.path}\u0000${v.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => byteOrder(a.path, b.path) || byteOrder(a.kind, b.kind));
}
