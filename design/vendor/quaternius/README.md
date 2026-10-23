# River game characters v3

All used upstream assets are CC0 1.0 by Quaternius. Original license text is kept alongside this file.

- Universal Base Characters (Standard): https://quaternius.itch.io/universal-base-characters
  - Author's ZIP downloaded through itch.io on 2026-10-22. Uses Superhero Male/Female heads, eyes, eyebrows and SimpleParted/Long hairstyles. Original UVs, normal maps and skin weights retained; the unused body is cut below the clothing collar. BV hair geometry is lengthened and weighted between Head and spine_03.
- Modular Character Outfits – Fantasy (Standard): https://quaternius.itch.io/modular-character-outfits-fantasy
  - Male_Ranger / Female_Ranger outfit, with hood removed. Geometry, UVs, weights, base color, normal and ORM textures are artist-authored. Asset files acquired from https://github.com/agentkaerf/FreeModels/tree/main/Modular%20Character%20Outfits%20-%20Fantasy%5BStandard%5D with its original CC0 notice. Dark PBR color factors customize the original palette.
- Universal Animation Library (Standard): https://quaternius.com/packs/universalanimationlibrary.html
  - Idle_Loop, Jog_Fwd_Loop and Walk_Loop, retargeted in Blender to the outfit rig. Source file and CC0 notice acquired from https://github.com/Seyamalam/blood-league-kickoff/tree/main/public/assets/vendor/quaternius and documented by that mirror in docs/ASSET_CREDITS.md. This is the current 65-bone humanoid version, not the older DEF-bone OGA export.

The exact source file hashes are in source-hashes.json. Source downloads are staged under outputs/vendor/quaternius (ignored working files). The author-provided ZIP remains in Downloads. Editable packed results are design/river-alexx-v3.blend and design/river-bv-v3.blend; browser GLBs are public/models/river-*-v3.glb. Run tools/blender/build_pair_characters_v3.py in Blender after staging the source packs in the paths documented by that script. After Blender export run `node scripts/optimize-river-character-assets.mjs` to compact embedded maps. No downloaded third-party code is executed.

The animation is not procedural limb oscillation. Rest-space rotation retargeting preserves the authored gait; a pelvis correction preserves source foot height with target proportions. The browser only blends complete clips and turns the actor root toward actual travel. Up to 1K embedded maps limit browser downloads; original full-resolution vendor textures remain in the staging directory.

This is a stylized game-asset adaptation, not a faithful reconstruction of the supplied cyberpunk illustration. The illustration's bespoke outfit and face are not present in these free source packs.

The jog is sampled at 60 Hz, cyclically smoothed and given matching local entry/exit velocities to remove the source loop hesitation. The underlying poses remain from the authored CC0 clip.


Motion revision 3 (2026-10-23): the existing character set is retained. Run now
uses the author's Walk_Loop at a compact 1.10-second cycle. The prior global
per-bone smoothing is removed because it introduced lateral foot motion.
Foot trajectories are shortened with two-bone IK, preserving limb lengths,
knee bend planes, twist helpers and global foot orientation. The browser uses
1.25 playback rate and 1.35 world units/second to match the smaller stance
motion. Idle/Walk and all geometry/material identity choices are preserved.


Motion revision 4 (2026-10-23) supersedes revision 3: Run uses Jog_Fwd_Loop
with a 0.90-second cycle, playback rate 1.0 and world speed 3.55. The pelvis
stays near idle height. Floor correction is per foot, never a minimum-foot
translation of the entire body. Stable anatomical IK poles and rest-space
leg twist avoid interpolation flips at near-straight knees. Torso motion is
blended toward idle, while the authored bent-arm jog and shortened foot paths
remain. Regression checks now sample intermediate frames and vertical speed,
not just overall displacement or matching loop endpoints.


Motion revision 5 keeps the same CC0 source meshes and Jog_Fwd_Loop. Average torso lean is treated separately from cyclic rotation, restoring shoulder/hip rhythm. The authored pelvis phase is low-pass reconstructed with a 0.024-unit range; independent foot contact IK stays in place. Both runtime GLBs and editable Blender files were rebuilt. Local runtime selection uses motion=5.


Motion revision 6 retains the original CC0 meshes and animation phase. Arm swing is reduced around the mean authored bent-elbow pose; ankle sweep and lift are reduced. Runtime playback is 1.45x with 4.6-unit travel speed. Both editable Blender sources and GLBs were rebuilt; local selection uses motion=6. See outputs/river-v6/ for exported trajectory and current-page checks.
