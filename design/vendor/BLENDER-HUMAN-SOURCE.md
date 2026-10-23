# Blender Human Base Meshes provenance

- Upstream: Blender Studio and Blender community, Human Base Meshes bundle v1.4.1.
- Official listing: https://www.blender.org/download/demo-files/
- Official documentation: https://developer.blender.org/docs/release_notes/3.6/asset_bundles/
- Download: https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip
- Retrieved: 2026-10-22.
- License: CC0 1.0, as stated by the official listing and the bundle's `README` ("All provided assets are public domain under the CC0 license.").
- Included source objects: `GEO-body_male_realistic`, `GEO-body_female_realistic`, and their four eye meshes. The selected objects and upstream README are packed into `blender-human-base-source.blend` for reproducible offline builds. No upstream scripts are executed.

The upstream archive's unrelated legacy `License` text mentions the Rain Rig under CC-BY. The selected objects are the Human Base Meshes covered by the explicit bundle README and official CC0 listing; no Rain Rig is imported.

Local adaptations: scaled anatomical bodies, skinning, fitted clothing, closed hair locks, draped fabric and lining, hood, metallic hardware, materials, cyclic animations, and browser GLB exports. Fabric color references were generated in `design/river-characters-v1`; the original human mesh silhouette is retained instead of deriving geometry from image alpha.
