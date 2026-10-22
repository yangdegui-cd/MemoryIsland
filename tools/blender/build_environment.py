"""Detailed modular ivory bridge and ornate portal for the river scene."""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
marble=mat('Warm ivory marble',(.78,.75,.66),.08,.3)
light=mat('Cut limestone edges',(.90,.86,.75),.04,.42)
gold=mat('Antique champagne gilding',(.64,.44,.19),.78,.28)
inlay=mat('Fine gold stone inlay',(.53,.38,.18),.65,.35)
shadow=mat('Recessed warm stone',(.52,.51,.47),.04,.63)
crystal=mat('Sky crystal',(.16,.48,.52),.45,.22)
# Bake subtle marble grain once into a reusable UV texture for real glTF materials.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
bpy.ops.mesh.primitive_plane_add();plane=bpy.context.object;plane.data.materials.append(marble)
n=marble.node_tree.nodes;l=marble.node_tree.links;p=n.get('Principled BSDF')
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.2;noise.inputs['Detail'].default_value=5;noise.inputs['Roughness'].default_value=.65
wave=n.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL';wave.inputs['Scale'].default_value=3;wave.inputs['Distortion'].default_value=3.5;wave.inputs['Detail'].default_value=5
coord=n.new('ShaderNodeTexCoord'); warp=n.new('ShaderNodeVectorMath');warp.operation='SCALE';warp.inputs[3].default_value=.28;l.new(noise.outputs['Color'],warp.inputs[0]);add=n.new('ShaderNodeVectorMath');add.operation='ADD';l.new(coord.outputs['UV'],add.inputs[0]);l.new(warp.outputs['Vector'],add.inputs[1]);l.new(add.outputs['Vector'],wave.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.025;ramp.color_ramp.elements[0].color=(.70,.69,.66,1);ramp.color_ramp.elements[1].position=.055;ramp.color_ramp.elements[1].color=(.77,.76,.72,1)
l.new(wave.outputs['Color'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
image=bpy.data.images.new('River ivory marble',width=2048,height=2048);target=n.new('ShaderNodeTexImage');target.image=image;n.active=target
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
bpy.ops.object.bake(type='DIFFUSE');image.pack()
l.new(target.outputs['Color'],p.inputs['Base Color'])
# Bake a millimetre-scale normal map so stone catches light without looking chipped.
fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=150;fine.inputs['Detail'].default_value=2
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.06;bump.inputs['Distance'].default_value=.0015
l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
normal_image=bpy.data.images.new('Polished marble micro normal',width=1024,height=1024);normal_image.colorspace_settings.name='Non-Color'
nt=n.new('ShaderNodeTexImage');nt.image=normal_image;n.active=nt
bpy.ops.object.bake(type='NORMAL');normal_image.pack()
nm=n.new('ShaderNodeNormalMap');l.new(nt.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],p.inputs['Normal'])
bpy.data.objects.remove(plane,do_unlink=True)
parts={}
def finish(o,name,material,part,bevel=0):
 o.name=name;o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Soft hand cut edges','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for f in o.data.polygons:f.use_smooth=True
 # Weighted split normals keep broad stone faces flat and bevel highlights soft.
 try:
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 except Exception:pass
 parts.setdefault(part,[]).append(o);return o

def box(name,loc,scale,m,part,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,part,bevel)
def sphere(name,loc,scale,m,part):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,part)
def tube(name,points,r,m,part):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=8;c.bevel_depth=r;c.bevel_resolution=3;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,v in zip(sp.bezier_points,points):b.co=v;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,m,part)
def lathe(name,x,y,z,profile,m,part,n=20):
 verts=[]
 for h,r in profile:
  for i in range(n):a=i/n*math.tau;verts.append((x+math.cos(a)*r,y+math.sin(a)*r,z+h))
 faces=[]
 for j in range(len(profile)-1):
  for i in range(n):k=j*n+i;faces.append((k,j*n+(i+1)%n,(j+1)*n+(i+1)%n,k+n))
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,m,part)
# Eight-unit-wide road, stone slab thickness and continuous underside molding.
part='BridgeRoad';box('Bridge bed',(0,0,-.23),(8.4,2.2,.42),shadow,part,.035)
for x in [-3,-1,1,3]:
 box('Large polished paver',(x,0,-.035),(1.989,2.188,.12),marble,part,.008)
for x in [-3.75,-3.63,3.63,3.75]:box('Long gold inlay',(x,0,.032),(.022,2.2,.008),inlay,part,.003)
for side in [-1,1]:
 box('Projecting edge cornice',(side*4.1,0,-.12),(.45,2.2,.18),light,part,.025)
 box('Gilded bridge edging',(side*4.23,0,-.05),(.025,2.2,.026),gold,part,.005)
# A compass medallion is a separate module, repeated only every fourth slab.
part='BridgeMedallion'
for radius in [1.0,.86]:
 tube('Compass circular engraving',[(math.cos(i/48*math.tau)*radius,math.sin(i/48*math.tau)*radius,.034) for i in range(49)],.008,inlay,part)
star=[]
for i in range(17):
 a=i/16*math.tau;r=.79 if i%2==0 else .21;star.append((math.cos(a)*r,math.sin(a)*r,.034))
tube('Compass star engraving',star,.009,inlay,part)
# Slender turned balusters and layered classical rail capitals.
for side in [-1,1]:
 part='BridgeLeftRail' if side<0 else 'BridgeRightRail';x=side*4.04
 box('Balustrade plinth',(x,0,.115),(.38,2.2,.23),light,part,.025)
 box('Rounded handrail',(x,0,1.12),(.4,2.22,.14),marble,part,.028)
 box('Rounded stone rail crest',(x,0,1.205),(.33,2.22,.04),light,part,.012)
 tube('Fine handrail gilding',[(x-side*.145,-1.11,1.225),(x-side*.145,1.11,1.225)],.006,gold,part)
 for y in [-.82,-.28,.28,.82]:
  lathe('Carved baluster',x,y,.23,[(0,.095),(.04,.10),(.10,.055),(.25,.085),(.38,.09),(.56,.045),(.72,.052),(.77,.08),(.82,.08)],light,part,40)
 box('Square pier',(x,1.06,.62),(.29,.25,1.0),marble,part,.022)
 box('Pier foot',(x,1.06,.26),(.42,.38,.14),light,part,.018)
 box('Pier capital',(x,1.06,1.19),(.44,.4,.11),light,part,.018)
 box('Pier gilt molding',(x,1.06,1.26),(.36,.32,.045),gold,part,.008)
 lathe('Carved pier urn',x,1.06,1.29,[(0,.085),(.04,.10),(.1,.07),(.18,.08),(.23,.045),(.28,0)],light,part,40)
# A roadside pavilion: its long facade is aligned with the road at runtime.
# Four free-standing columns, a coffered canopy and an inset arched light doorway.
part='Portal'
roofmat=mat('Pearl glazed pavilion roof',(.36,.43,.42),.32,.27)
stonebase=mat('Honed warm limestone',(.61,.59,.53),.02,.48)
box('Pavilion foundation',(0,0,-.25),(4.9,5.25,.46),stonebase,part,.05)
box('Rebated platform cornice',(0,0,-.04),(4.82,5.2,.13),light,part,.028)
box('Pavilion floor',(0,.15,.045),(4.55,4.6,.10),marble,part,.012)
# Broad, shallow steps connect the entrance directly to the clear road edge.
for y,z,w,d in [(-2.42,.0,3.3,.44),(-2.15,.065,3.24,.40),(-1.88,.13,3.18,.36)]:
 box('Shallow entrance step',(0,y,z),(w,d,.13),marble,part,.018)
for x in [-1.98,1.98]:box('Floor border inlay',(x,.15,.102),(.013,3.85,.009),inlay,part,.003)
# Tall classical columns; narrow proportions and high radial resolution.
for x in [-1.70,1.70]:
 for y in [-1.46,1.53]:
  box('Column stepped plinth',(x,y,.23),(.51,.51,.27),stonebase,part,.022)
  box('Column plinth molding',(x,y,.39),(.54,.54,.08),light,part,.015)
  lathe('Column torus foot',x,y,.43,[(0,.23),(.025,.25),(.065,.25),(.1,.19),(.16,.17)],light,part,48)
  lathe('Tapered marble column',x,y,.58,[(0,.17),(.15,.165),(1.3,.151),(2.6,.137),(3.53,.14)],marble,part,64)
  for j in range(16):
   a=j/16*math.tau
   tube('Delicate column fluting',[(x+math.cos(a)*.163,y+math.sin(a)*.163,.79),(x+math.cos(a)*.136,y+math.sin(a)*.136,3.93)],.006,light,part)
  lathe('Column collar',x,y,4.08,[(0,.16),(.04,.19),(.07,.19),(.1,.17)],gold,part,48)
  lathe('Carved capital',x,y,4.16,[(0,.17),(.07,.19),(.14,.25),(.20,.27)],light,part,48)
  box('Capital abacus',(x,y,4.43),(.59,.59,.13),marble,part,.016)
  for j in range(8):
   a=j/8*math.tau
   leaf=sphere('Capital acanthus leaf',(x+math.cos(a)*.22,y+math.sin(a)*.22,4.23),(.035,.06,.13),light,part);leaf.rotation_euler.z=-a
# Recessed architrave and continuous cornice; underside coffers remain visible.
for z,w,d,h,m in [(4.52,4.25,4.05,.14,stonebase),(4.62,4.48,4.32,.11,marble),(4.71,4.62,4.46,.07,gold),(4.78,4.85,4.69,.12,light),(4.87,5.05,4.89,.07,marble)]:
 box('Layered pavilion cornice',(0,.035,z),(w,d,h),m,part,.018)
for x in [-1.12,0,1.12]:
 for y in [-1.04,.05,1.14]:
  box('Coffered ceiling recess',(x,y,4.435),(.91,.88,.025),shadow,part,.015)
  box('Coffered ceiling panel',(x,y,4.421),(.73,.70,.023),light,part,.014)
# A softly curved hipped roof, not a flat signboard or a solid gold cap.
profile=[(4.90,2.58,2.50),(4.98,2.64,2.56),(5.07,2.50,2.42),(5.22,2.15,2.08),(5.48,1.66,1.61),(5.72,1.10,1.06),(5.94,.45,.44),(6.04,.08,.08)]
N=64; verts=[]
for z,rx,ry in profile:
 for i in range(N):
  a=i/N*math.tau;c=math.cos(a);s=math.sin(a)
  verts.append((rx*math.copysign(abs(c)**.45,c),.035+ry*math.copysign(abs(s)**.45,s),z))
faces=[]
for row in range(len(profile)-1):
 for i in range(N):k=row*N+i;faces.append((k,row*N+(i+1)%N,(row+1)*N+(i+1)%N,k+N))
faces.append(tuple((len(profile)-1)*N+i for i in range(N)))
me=bpy.data.meshes.new('Curved hip roof');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Curved hip roof',me);bpy.context.collection.objects.link(ob);finish(ob,'Pearl glazed hip roof',roofmat,part)
for j in range(12):
 a=j/12*math.tau;c=math.cos(a);s=math.sin(a)
 tube('Fine roof rib',[(rx*math.copysign(abs(c)**.45,c),.035+ry*math.copysign(abs(s)**.45,s),z+.009) for z,rx,ry in profile],.009,gold,part)
for z,rx,ry in [profile[1]]:
 tube('Roof drip edge',[(rx*math.copysign(abs(math.cos(i/N*math.tau))**.45,math.cos(i/N*math.tau)),.035+ry*math.copysign(abs(math.sin(i/N*math.tau))**.45,math.sin(i/N*math.tau)),z) for i in range(N+1)],.018,gold,part)
lathe('Roof finial',0,.035,6.03,[(0,.11),(.08,.15),(.15,.10),(.26,.07),(.40,0)],gold,part,48)
# A genuine recessed doorway at the back of the pavilion; clear standing space ahead.
for x in [-1.14,1.14]:
 box('Door jamb foot',(x,.78,.23),(.40,.48,.24),light,part,.018)
 box('Recessed door jamb',(x,.78,1.78),(.22,.32,3.0),marble,part,.023)
 tube('Door jamb gilded reveal',[(x,.58,.34),(x,.58,3.25)],.012,gold,part)
for radius,thickness,m,y in [(1.14,.115,marble,.78),(1.14,.018,gold,.575),(1.27,.022,light,.77)]:
 tube('Rounded doorway archivolt',[(math.cos(i/48*math.pi)*radius,y,3.16+math.sin(i/48*math.pi)*radius) for i in range(49)],thickness,m,part)
# Low rear balustrades give the pavilion volume without closing its road-facing side.
for x in [-1.83,1.83]:
 box('Side pavilion parapet',(x,.62,.22),(.20,1.4,.2),light,part,.02)
 box('Side pavilion handrail',(x,.62,1.04),(.23,1.4,.11),marble,part,.02)
 for y in [.08,.44,.80,1.16]:lathe('Side baluster',x,y,.32,[(0,.065),(.08,.07),(.3,.04),(.51,.065),(.65,.04)],light,part,32)

# Consolidate modular pieces by category/material; runtime instances share geometry.
roots={}
for label,objects in parts.items():
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=label
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 roots[label]=o
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/river-architecture.glb'),export_format='GLB',use_selection=True,export_animations=False)
# Preserve editable native source, with embedded baked marble.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/river-architecture.blend'))
print('RIVER_ARCHITECTURE_READY',list(roots),len(image.pixels))
