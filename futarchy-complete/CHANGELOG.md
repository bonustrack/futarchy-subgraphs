# Changelog

All notable changes to this project will be documented in this file.

## [0.0.14] - 2026-01-26
### Added
- **Deep Value Indexing**: Added `MetadataEntry` entity to store key-value pairs from metadata JSON.
- **Filtering**: Enables filtering by specific internal values, e.g. `where: { metadataEntries_: { key: "chain", value: "100" } }`.

## [0.0.13] - 2026-01-26

### Added
- **JSON Key Indexing**: Added `metadataProperties` field to `Aggregator`, `Organization`, and `ProposalEntity` entities.
- **Mapping Logic**: Implemented `extractKeys` helper in `src/mapping.ts` to parse JSON metadata and automatically populate `metadataProperties` with top-level keys. This enables filtering entities based on the presence of specific metadata fields.

## [0.0.11] - 2026-01-26
- Initial implementation of JSON Key Indexing for `ProposalEntity` (superseded by 0.0.12).
