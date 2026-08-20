# Legacy NestMetric migration

The current validated application remains the rollback baseline while Phase 2 is introduced.

Migration boundary:
1. Export legacy projects, measurements, objects, openings, uploads and build plans to JSON plus encrypted asset files.
2. Convert physical values to integer micrometres.
3. Preserve measurement source/confidence/tolerance/verification/correction history.
4. Import projects first, then rooms, evidence, geometry, assets, proposals and build plans inside owner-scoped transactions.
5. Validate row counts, ownership, asset hashes and build-plan references before cutover.
6. Do not delete the legacy store until a post-cutover retention window has passed.
