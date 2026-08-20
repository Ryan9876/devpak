# NestMetric Project Constitution

1. NestMetric is a functional photo-augmentation product, not a CAD application. The photographed room and believable visual outcomes are the primary user-facing experience; plan/geometry views exist to support precision, constraints, evidence, and Build workflows rather than define the product.
2. Physical-space decisions must be derived from one canonical Room Model. Organize, Arrange, Build, AI, web capture, and optional LiDAR cannot maintain conflicting room representations.
3. The Room Model is authoritative for measured geometry and build-readiness. A perspective photo or generated visual must never be presented as dimensionally calibrated merely because a top-down Room Model exists; photo-to-geometry projection requires explicit calibration/evidence.
4. Dimensions are evidence, not truth by default. Source, confidence, tolerance, calibration/device context, verification, and corrections must remain traceable.
5. AI visual proposals are advisory augmentations. They must remain distinguishable from the original room photo and must not silently mutate measurements, Room Model coordinates, constraints, or build-readiness evidence.
6. Deterministic geometry and build-readiness checks remain authoritative safety boundaries. Generated build plans must not be presented as build-ready until required measurements are verified or explicitly corrected.
7. User projects, source photos, generated visuals, and room assets are private by default, owner-scoped, and protected at the data/storage layer rather than only in UI routing.
8. Durable production state must use durable database/object storage. Ephemeral Vercel filesystem state is permitted only for disposable review/demo environments.
9. LiDAR/AR is an optional enhancement on supported devices; core web functionality cannot depend on it.
10. Deployments are distinguished as generated, validated, preview-deployed, production-deployed, and deployment-verified. A successful build alone is not production completion.
