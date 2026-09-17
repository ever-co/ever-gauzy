# @gauzy/plugin-catalog

The catalog plugin for the Gauzy platform. It owns everything the platform needs to **present** a
product rather than merely store it:

| table | what it holds |
|---|---|
| `product_channel` | publication of a product on one sales channel |
| `product_variant_channel` | publication of a single variant on one channel |
| `collection` | a curated merchandising group, manual, rule-based or hybrid |
| `collection_closure` | the closure table the ORM maintains for the collection tree — derived, never declared as an entity |
| `collection_product` | manual product membership with position |
| `collection_variant` | manual variant membership with position |
| `collection_channel` | publication of a collection on one channel |
| `product_relation` | directed, typed product-to-product links |
| `product_variant_media` | a per-variant gallery |
| `tag_product_variant` | variant-level facets on the platform tag system |

The product, variant, category, tag and image tables themselves are **platform** tables: this plugin
extends them through the kernel migration set and never declares a parallel copy of any of them.

## Building

Run `yarn nx build plugin-catalog` to build the library.

## Running unit tests

Run `yarn run test plugin-catalog` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-catalog`, go to the dist folder
`dist/packages/plugins/catalog` and run `npm publish`.

## Installation

Install the Catalog Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-catalog
# or
yarn add @gauzy/plugin-catalog
```
