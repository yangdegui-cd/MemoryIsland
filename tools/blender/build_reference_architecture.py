"""Build double-sided relief architecture from the approved reference assets.

This is a textured relief reconstruction, not a claim of recovered 360-degree
sculpture. The front/back share the same silhouette, UVs and relief. Side depth
is authored, and all portal light is animated separately in the web renderer.
Run after build_environment.py; the previous source is preserved as the base.
"""
import bpy
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'design/river-assets-v8'
OUT = ROOT / 'public/art/river-v8'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'design/river-architecture.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.render.bake.margin = 8

def load_image(name):
    image = bpy.data.images.load(str(ASSETS / name), check_existing=True)
    image.pack()
    return image

frame_image = load_image('portal-frame.png')
paving_image = load_image('paving-albedo.png')
active_image = load_image('portal-active.png')

def surface(name, image, metal=0, rough=.36):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n = mat.node_tree.nodes
    p = n.get('Principled BSDF')
    tex = n.new('ShaderNodeTexImage')
    tex.image = image
    mat.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    p.inputs['Coat Weight'].default_value = .25
    return mat

ivory = surface('Reference portal carved ivory', frame_image, .04, .39)
gold = surface('Reference portal sculpted gold', frame_image, .70, .28)
side_stone=bpy.data.images.load(str(ROOT/'public/art/river-ivory-marble-v4.png'),check_existing=True)
side_stone.pack()
edge=surface('Reference portal side stone',side_stone,.04,.38)

for name in ['Portal', 'PortalAperture', 'BridgeMedallion']:
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)

# Read the transparent outline into an actual closed mesh, including the door
# opening and wings. Both surfaces carry shallow, light-responsive sculpting.
w, h = frame_image.size
pixels = np.array(frame_image.pixels[:], dtype=np.float32).reshape(h, w, 4)
opaque = pixels[:, :, 3] > .5
ys, xs = np.where(opaque)
y0, y1 = int(ys.min()), int(ys.max())
scale = 6.4 / (y1 - y0)
nx, nz = 240, 360
px = np.linspace(0, w-1, nx+1)
pz = np.linspace(0, h-1, nz+1)
samples = pixels[np.round(pz).astype(int)[:, None], np.round(px).astype(int)[None, :]]
centers = pixels[np.round((pz[:-1]+pz[1:])/2).astype(int)[:, None], np.round((px[:-1]+px[1:])/2).astype(int)[None, :]]
mask = centers[:, :, 3] > .55
verts, faces, uv_coords, face_mats = [], [], [], []
indices = {}
depth_center = .78

def vertex(ix, iz, side):
    key = (ix, iz, side)
    if key not in indices:
        c = samples[iz, ix]
        # Raised gold ornament and lower stone panels, on both faces equally.
        gilded = max(0, min(1, (float(c[0]) - float(c[2])) * 2.4))
        lum = float(c[:3].mean())
        z = (pz[iz]-y0)*scale
        foundation = .12 if z < 1.12 else 0
        capital = .07 if 4.4 < z < 4.85 else 0
        thickness = .22 + foundation + capital + gilded*.055 + lum*.012
        indices[key] = len(verts)
        verts.append(((px[ix]-w/2)*scale, depth_center + side*thickness, z))
        uv_coords.append((px[ix]/w, pz[iz]/h))
    return indices[key]

for iz, ix in zip(*np.where(mask)):
    cell = [(ix, iz), (ix+1, iz), (ix+1, iz+1), (ix, iz+1)]
    c = centers[iz, ix]
    mi = 1 if c[0]-c[2] > .16 and c[0] > c[1]*1.06 else 0
    for side in [-1, 1]:
        face = tuple(vertex(x, z, side) for x, z in cell)
        faces.append(face if side == -1 else tuple(reversed(face)))
        face_mats.append(mi)
    for a, b, dx, dz in [(cell[0],cell[1],0,-1),(cell[1],cell[2],1,0),(cell[2],cell[3],0,1),(cell[3],cell[0],-1,0)]:
        xx, zz = ix+dx, iz+dz
        if not (0 <= xx < nx and 0 <= zz < nz and mask[zz, xx]):
            faces.append((vertex(*a,-1),vertex(*a,1),vertex(*b,1),vertex(*b,-1)))
            face_mats.append(2)

me = bpy.data.meshes.new('Reference carved double-sided volume')
me.from_pydata(verts, [], faces)
me.update()
ob = bpy.data.objects.new('Portal', me)
bpy.context.collection.objects.link(ob)
for material in [ivory, gold, edge]:
    me.materials.append(material)
uv = me.uv_layers.new(name='Reference projection')
for poly, mi in zip(me.polygons, face_mats):
    poly.material_index = mi
    poly.use_smooth = mi != 2
    for li in poly.loop_indices:
        uv.data[li].uv = uv_coords[me.loops[li].vertex_index]
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
# Relax the sampled boundary before simplification; pixel stair steps must not
# become stair steps in the side wall. Equal treatment preserves both faces.
smooth=ob.modifiers.new('Relax sampled silhouette','SMOOTH')
smooth.factor=.75;smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
dec = ob.modifiers.new('Preserve silhouette and sculpting', 'DECIMATE')
dec.ratio = .42
dec.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=dec.name)
bevel=ob.modifiers.new('Carved stone edge bevel','BEVEL')
bevel.width=.012;bevel.segments=3;bevel.limit_method='ANGLE';bevel.angle_limit=.65
bpy.ops.object.modifier_apply(modifier=bevel.name)

# The aperture has the SAME projection coordinates as the frame and both
# state images. Slight underlap disappears inside the solid frame volume.
base_px = 87
spring_px = 1105
top_px = 1304
half_px = 215
opening = [(-half_px+w/2,base_px),(half_px+w/2,base_px)]
opening += [(w/2+math.cos(i/96*math.pi)*half_px, spring_px+math.sin(i/96*math.pi)*(top_px-spring_px)) for i in range(97)]
points = [(w/2,(base_px+top_px)/2)] + opening
apverts = [((x-w/2)*scale,depth_center,(z-y0)*scale) for x,z in points]
apfaces = [(0,i+1,(i+1)%len(opening)+1) for i in range(len(opening))]
me = bpy.data.meshes.new('Reference fitted aperture')
me.from_pydata(apverts, [], apfaces)
me.update()
uv = me.uv_layers.new(name='Reference projection')
for poly in me.polygons:
    for li in poly.loop_indices:
        x,z = points[me.loops[li].vertex_index]
        uv.data[li].uv = (x/w,z/h)
ap = bpy.data.objects.new('PortalAperture', me)
bpy.context.collection.objects.link(ap)
preview_magic = surface('Portal preview emission', active_image)
p = preview_magic.node_tree.nodes.get('Principled BSDF')
tex = next(n for n in preview_magic.node_tree.nodes if n.type == 'TEX_IMAGE')
preview_magic.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color'])
p.inputs['Emission Strength'].default_value = 1.3
ap.data.materials.append(preview_magic)

metadata = {
    'width': w*scale, 'height':h*scale, 'bottom':-y0*scale,
    'glassHalfWidth':half_px*scale, 'glassBottom':(base_px-y0)*scale,
    'springHeight':(spring_px-y0)*scale, 'glassRise':(top_px-spring_px)*scale,
    'depth':depth_center,
    'uvBounds':[(w/2-half_px)/w,base_px/h,half_px*2/w,(top_px-base_px)/h],
    'crownHeight':(1360-y0)*scale,
    'construction':'double-sided textured relief with closed sidewalls',
    'frameTriangles':sum(len(p.vertices)-2 for p in ob.data.polygons),
}
(ROOT/'tools/blender/river-reference-profile.json').write_text(json.dumps(metadata,indent=2)+'\n')

# Replace the disconnected decorative tubes/pavers with an authored surface
# using the reference gold inlay. Each module uses a quarter of an 8.8m tile;
# runtime adds the four phases per instance so the motif never slides alone.
oldroad = bpy.data.objects.get('BridgeRoad')
if oldroad:
    bpy.data.objects.remove(oldroad, do_unlink=True)
roadroot = bpy.data.objects.new('BridgeRoad', None)
bpy.context.collection.objects.link(roadroot)
paving = surface('Reference paving', paving_image, .14, .30)

def bevel_box(name, loc, size, material, parent, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b = o.modifiers.new('Rounded stone cut', 'BEVEL')
    b.width = bevel
    b.segments = 3
    bpy.ops.object.modifier_apply(modifier=b.name)
    o.data.materials.append(material)
    o.parent = parent
    return o

base_mat = bpy.data.materials.get('Recessed warm stone')
bevel_box('Continuous bridge foundation',(0,0,-.19),(8.35,2.2,.35),base_mat,roadroot,.035)
# One surface avoids double seams at modular boundaries; cut lines live in UV.
verts=[(-4,-1.1,.03),(4,-1.1,.03),(4,1.1,.03),(-4,1.1,.03)]
me=bpy.data.meshes.new('Reference paving surface')
me.from_pydata(verts,[],[(0,1,2,3)])
me.update()
uv=me.uv_layers.new(name='Continuous four-module motif')
coords=[(0,0),(1,0),(1,.25),(0,.25)]
for poly in me.polygons:
    for li in poly.loop_indices:
        uv.data[li].uv=coords[me.loops[li].vertex_index]
o=bpy.data.objects.new('Reference paving',me)
bpy.context.collection.objects.link(o)
o.parent=roadroot
me.materials.append(paving)
for side in [-1,1]:
    bevel_box('Rounded road shoulder',(side*4.10,0,-.005),(.28,2.2,.17),edge,roadroot,.025)

# Bake physical micro-normal and gold/stone roughness into real glTF maps.
# These are shader-data bakes, not painted lighting/reflection in the albedo.
def bake_material_maps(mat):
    bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-30))
    plane=bpy.context.object
    plane.data.materials.append(mat)
    n=mat.node_tree.nodes; links=mat.node_tree.links
    p=n.get('Principled BSDF')
    color=next(node for node in n if node.type=='TEX_IMAGE').outputs['Color']
    sep=n.new('ShaderNodeSeparateColor');links.new(color,sep.inputs[0])
    diff=n.new('ShaderNodeMath');diff.operation='SUBTRACT';links.new(sep.outputs[0],diff.inputs[0]);links.new(sep.outputs[2],diff.inputs[1])
    strength=n.new('ShaderNodeMath');strength.operation='MULTIPLY';strength.inputs[1].default_value=3.0;strength.use_clamp=True;links.new(diff.outputs[0],strength.inputs[0])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.012;links.new(strength.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],p.inputs['Normal'])
    normal=bpy.data.images.new('Reference paving micro normal',width=1254,height=1254);normal.colorspace_settings.name='Non-Color'
    dest=n.new('ShaderNodeTexImage');dest.image=normal;n.active=dest
    bpy.ops.object.bake(type='NORMAL')
    normal.pack()
    normal.filepath_raw=str(OUT/'paving-normal.png');normal.file_format='PNG';normal.save()
    nm=n.new('ShaderNodeNormalMap');links.new(dest.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
    # Encode roughness/metalness into green/blue glTF ORM channels.
    out=n.get('Material Output');em=n.new('ShaderNodeEmission')
    combine=n.new('ShaderNodeCombineColor');combine.inputs[0].default_value=1
    rough=n.new('ShaderNodeMath');rough.operation='MULTIPLY_ADD';rough.inputs[1].default_value=-.12;rough.inputs[2].default_value=.36;links.new(strength.outputs[0],rough.inputs[0])
    metal=n.new('ShaderNodeMath');metal.operation='MULTIPLY';metal.inputs[1].default_value=.72;links.new(strength.outputs[0],metal.inputs[0])
    links.new(rough.outputs[0],combine.inputs[1]);links.new(metal.outputs[0],combine.inputs[2]);links.new(combine.outputs[0],em.inputs[0]);links.new(em.outputs[0],out.inputs['Surface'])
    orm=bpy.data.images.new('Reference paving ORM',width=1254,height=1254);orm.colorspace_settings.name='Non-Color'
    target=n.new('ShaderNodeTexImage');target.image=orm;n.active=target
    bpy.ops.object.bake(type='EMIT')
    orm.pack();orm.filepath_raw=str(OUT/'paving-orm.png');orm.file_format='PNG';orm.save()
    links.new(p.outputs[0],out.inputs['Surface'])
    channels=n.new('ShaderNodeSeparateColor');links.new(target.outputs['Color'],channels.inputs[0]);links.new(channels.outputs[1],p.inputs['Roughness']);links.new(channels.outputs[2],p.inputs['Metallic'])
    bpy.data.objects.remove(plane,do_unlink=True)

bake_material_maps(paving)
# Carry the same paving material onto the curved bay. Replace its old turned
# spindles with the same carved arcade used along the road.
import bmesh
bay = bpy.data.objects.get('PortalTerrace')
if bay:
    bm=bmesh.new();bm.from_mesh(bay.data)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if any(v.co.z > .08 for v in f.verts)],context='FACES')
    bm.to_mesh(bay.data);bm.free()
    bay.data.update()
    terrace_mat=paving.copy();terrace_mat.name='Reference terrace'
    bay.data.materials.append(terrace_mat)
    if not bay.data.uv_layers:
        bay.data.uv_layers.new(name='Terrace stone projection')
    uv=bay.data.uv_layers.active
    for poly in bay.data.polygons:
        if poly.normal.z > .8 and min(bay.data.vertices[v].co.z for v in poly.vertices) > .02:
            poly.material_index=len(bay.data.materials)-1
            for li in poly.loop_indices:
                co=bay.data.vertices[bay.data.loops[li].vertex_index].co
                uv.data[li].uv=((co.x+4.35)/8.7,(co.y+4.35)/8.7)
    bay.name='Reference terrace foundation'
    container=bpy.data.objects.new('PortalTerrace',None)
    bpy.context.collection.objects.link(container);bay.parent=container
    for j in range(6):
        source=bpy.data.objects.get('BridgeLeftRail')
        rail=source.copy();rail.data=source.data.copy();rail.name='Curved carved arcade'
        bpy.context.collection.objects.link(rail);rail.parent=container
        for v in rail.data.vertices:
            radial=4.16+v.co.x+4.04
            a=(j+.5)*math.pi/6+v.co.y/2.2*math.pi/6
            v.co.x=math.cos(a)*radial;v.co.y=-2.25+math.sin(a)*radial
        rail.data.update()
    for j in [0,2,4,6]:
        source=bpy.data.objects.get('BridgeLeftPier')
        pier=source.copy();pier.data=source.data.copy();pier.name='Terrace square pier'
        bpy.context.collection.objects.link(pier);pier.parent=container
        a=j*math.pi/6
        for v in pier.data.vertices:
            x,y=v.co.x+4.04,v.co.y-1.06
            v.co.x=math.cos(a)*(4.16+x)-math.sin(a)*y
            v.co.y=-2.25+math.sin(a)*(4.16+x)+math.cos(a)*y
        pier.data.update()
# Retain all existing curved terrace/bridge modules; the reference portal is a
# new source asset so previous versions remain recoverable without Git resets.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/river-architecture-v8.glb'),export_format='GLB',use_selection=True,export_animations=False)
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.world.color=(.16,.19,.23)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/river-architecture-v8.blend'))
print('REFERENCE_ARCHITECTURE_READY',metadata)
