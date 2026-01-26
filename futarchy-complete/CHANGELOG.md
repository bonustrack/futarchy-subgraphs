# Changelog

All notable changes to this project will be documented in this file.

## [0.0.12] - 2026-01-26

### Added
- **JSON Key Indexing**: Added `metadataProperties` field to `Aggregator`, `Organization`, and `ProposalEntity` entities.
- **Mapping Logic**: Implemented `extractKeys` helper in `src/mapping.ts` to parse JSON metadata and automatically populate `metadataProperties` with top-level keys. This enables filtering entities based on the presence of specific metadata fields.

## [0.0.11] - 2026-01-26
- Initial implementation of JSON Key Indexing for `ProposalEntity` (superseded by 0.0.12).
