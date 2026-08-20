# NestMetric Project Constitution

1. Physical-space decisions must be derived from one canonical Room Model. Organize, Arrange, Build, AI, web capture, and optional LiDAR cannot maintain conflicting room representations.
2. Dimensions are evidence, not truth by default. Source, confidence, tolerance, calibration/device context, verification, and corrections must remain traceable.
3. AI suggestions are advisory. Deterministic geometry and build-readiness checks remain authoritative safety boundaries.
4. Generated build plans must not be presented as build-ready until required measurements are verified or explicitly corrected.
5. User projects and room assets are private by default, owner-scoped, and protected at the data/storage layer rather than only in UI routing.
6. Durable production state must use durable database/object storage. Ephemeral Vercel filesystem state is permitted only for disposable review/demo environments.
7. LiDAR/AR is optional enhancement on supported devices; core web functionality cannot depend on it.
8. Deployments are distinguished as generated, validated, preview-deployed, production-deployed, and deployment-verified. A successful build alone is not production completion.
