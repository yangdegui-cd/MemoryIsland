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
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=5;noise.inputs['Detail'].default_value=5;noise.inputs['Roughness'].default_value=.65
wave=n.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL';wave.inputs['Scale'].default_value=4;wave.inputs['Distortion'].default_value=9;wave.inputs['Detail'].default_value=5
l.new(noise.outputs['Fac'],wave.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.08;ramp.color_ramp.elements[0].color=(.57,.56,.51,1);ramp.color_ramp.elements[1].position=.22;ramp.color_ramp.elements[1].color=(.84,.81,.72,1)
l.new(wave.outputs['Color'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
image=bpy.data.images.new('River ivory marble',width=1024,height=1024);target=n.new('ShaderNodeTexImage');target.image=image;n.active=target
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
bpy.ops.object.bake(type='DIFFUSE');image.pack()
l.new(target.outputs['Color'],p.inputs['Base Color'])
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
 for y in [-.55,.55]:box('Individual bevelled paver',(x,y,-.035),(1.985,1.084,.12),marble,part,.014)
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
 box('Fine rail crest',(x,0,1.205),(.33,2.22,.04),gold,part,.008)
 for y in [-.82,-.28,.28,.82]:
  lathe('Carved baluster',x,y,.23,[(0,.095),(.04,.10),(.10,.055),(.25,.085),(.38,.09),(.56,.045),(.72,.052),(.77,.08),(.82,.08)],light,part,16)
 box('Square pier',(x,1.06,.62),(.29,.25,1.0),marble,part,.022)
 box('Pier foot',(x,1.06,.26),(.42,.38,.14),light,part,.018)
 box('Pier capital',(x,1.06,1.19),(.44,.4,.11),light,part,.018)
 box('Pier gilt molding',(x,1.06,1.26),(.36,.32,.045),gold,part,.008)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.12,location=(x,1.06,1.39));o=bpy.context.object;o.scale.z=1.5;finish(o,'Sunstone finial',gold,part)
# Portal pedestal and threshold are fully outside the road.
part='Portal';box('Floating bay foundation',(0,0,-.25),(4.6,3.8,.45),shadow,part,.08)
for z,w,d in [(-.06,4.45,3.65),(.03,4.15,3.35),(.12,3.85,3.05)]:box('Carved platform step',(0,0,z),(w,d,.13),marble,part,.035)
for x in [-1.65,1.65]:box('Platform gold inlay',(x,0,.195),(.025,2.65,.012),gold,part,.005)
# Columns with fluting, acanthus capitals and delicate gilded vines.
for side in [-1,1]:
 x=side*1.25
 box('Pedestal base',(x,0,.41),(.72,.8,.4),marble,part,.045)
 box('Pedestal gold bead',(x,0,.61),(.65,.72,.065),gold,part,.015)
 lathe('Fluted column core',x,0,.64,[(0,.25),(.10,.23),(.2,.19),(3.21,.17),(3.38,.23),(3.43,.27)],marble,part,32)
 for i in range(12):
  a=i/12*math.tau
  tube('Fine column flute',[(x+.18*math.cos(a),.18*math.sin(a),.92),(x+.155*math.cos(a),.155*math.sin(a),3.8)],.013,light,part)
 for z in [.78,3.9,4.02]:lathe('Capital molding',x,0,z,[(0,.26),(.035,.28),(.075,.26)],gold,part,32)
 box('Column abacus',(x,0,4.15),(.68,.7,.14),marble,part,.025)
 for face in [-1,1]:
  tube('Climbing gilded vine',[(x,face*.23,.9),(x+side*.09,face*.25,1.7),(x-side*.08,face*.25,2.6),(x+side*.05,face*.24,3.7)],.012,gold,part)
  for z in [1.2,1.8,2.4,3.0,3.55]:
   for s in [-1,1]:
    leaf=sphere('Acanthus gold leaf',(x+s*.08,face*.25,z),(.045,.015,.12),gold,part);leaf.rotation_euler.y=s*.55
# Pointed arch stone ring, correctly beveled front/back surfaces.
outer=[];inner=[]
for side in [-1,1]:
 seq=range(25) if side<0 else range(24,-1,-1)
 for i in seq:
  t=i/24
  xx=(1-t)**2*1.52+2*(1-t)*t*1.45
  zz=(1-t)**2*4.12+2*(1-t)*t*5.08+t*t*5.98
  ix=(1-t)**2*1.03+2*(1-t)*t*.98
  iz=(1-t)**2*4.12+2*(1-t)*t*4.83+t*t*5.48
  outer.append((side*xx,zz));inner.append((side*ix,iz))
N=len(outer);verts=[]
for y in [-.30,.30]:
 for seq in [outer,inner]:verts += [(x,y,z) for x,z in seq]
faces=[]
for i in range(N-1):
 for j in [0,2*N]:faces.append((j+i,j+i+1,j+N+i+1,j+N+i))
 faces.append((i,i+1,2*N+i+1,2*N+i));faces.append((N+i,N+i+1,3*N+i+1,3*N+i))
me=bpy.data.meshes.new('Pointed arch');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Pointed marble arch',me);bpy.context.collection.objects.link(o);finish(o,'Pointed arch',marble,part,.025)
for face in [-1,1]:
 for edge in [inner,outer]:tube('Champagne arch fillet',[(x,face*.335,z) for x,z in edge],.022,gold,part)
 for i in range(4,N-4,5):
  x=(inner[i][0]+outer[i][0])*.5;z=(inner[i][1]+outer[i][1])*.5
  sphere('Arch rosette',(x,face*.345,z),(.045,.02,.045),gold,part)
# High crown, starburst and side ornaments.
for side in [-1,1]:
 x=side*1.29
 tube('Winged crown flourish',[(x,0,4.2),(side*1.63,0,4.55),(side*1.73,0,5.05),(side*1.57,0,4.89)],.045,gold,part)
 for z in [4.45,4.65,4.85]:sphere('Crown gilded leaf',(side*(1.55+(z-4.45)*.4),0,z),(.075,.045,.13),gold,part)
for z,scale in [(6.03,.22),(6.55,.11)]:
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=scale,location=(0,0,z));o=bpy.context.object;o.scale=(.7,.5,1.75);finish(o,'Champagne star crystal',gold,part)
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
