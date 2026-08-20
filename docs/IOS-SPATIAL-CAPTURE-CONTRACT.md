# iOS Spatial Capture Contract

The native iOS capture path is optional and must feed the same canonical Room Model used by the web application. LiDAR/RoomPlan is an evidence source, not a parallel data model.

## Required output

Every capture adapter emits:
- `roomId`
- device model / OS
- capture timestamp and orientation
- measurement source: `ar` or `lidar`
- dimensions in integer micrometres
- tolerance and confidence
- verification state (always `estimated` until a user explicitly verifies/corrects a build-critical dimension)
- detected openings, fixed geometry and candidate objects using Room Model coordinates
- source asset references

## Safety rules

1. LiDAR estimates never silently become build-safe dimensions.
2. The user can correct any measurement, and correction history is retained.
3. Unsupported devices fall back to guided photo capture plus manual reference measurement.
4. The web and native clients render the same `schemaVersion: 2` Room Model.
