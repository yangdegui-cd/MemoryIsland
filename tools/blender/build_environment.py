"""Detailed modular ivory bridge and ornate portal for the river scene."""
import bpy, math, json
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PROFILE=json.loads((Path(__file__).parent/'river-portal-profile.json').read_text())
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
# Fine diagonal inlay and inset stone borders give each slab a readable cut edge.
for x in [-3,-1,1,3]:
 for sy in [-1,1]:
  tube('Inset paver perimeter',[(x-.92,sy*1.015,.031),(x+.92,sy*1.015,.031)],.0035,inlay,'BridgeRoad')
for side in [-1,1]:
 tube('Diagonal champagne lace',[(side*3.58,-1.10,.035),(side*2.65,0,.035),(side*3.58,1.10,.035)],.0055,gold,'BridgeRoad')
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
 # Flat carved stone arcade, rather than rows of turned balusters.
 for cy in [-.54,.54]:
  verts=[];steps=32
  for xx in [x-.095,x+.095]:
   for rx,rz in [(.54,.72),(.43,.60)]:
    for k in range(steps+1):
     angle=k/steps*math.pi;verts.append((xx,cy+math.cos(angle)*rx,.30+math.sin(angle)*rz))
  n=steps+1;faces=[]
  for k in range(steps):
   faces.extend([(k,k+1,n+k+1,n+k),(2*n+k,3*n+k,3*n+k+1,2*n+k+1),(k,2*n+k,2*n+k+1,k+1),(n+k,n+k+1,3*n+k+1,3*n+k)])
  faces.extend([(0,n,3*n,2*n),(steps,2*n-1,4*n-1,3*n-1)])
  me=bpy.data.meshes.new('Carved arcade');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new('Carved arcade',me);bpy.context.collection.objects.link(ob);finish(ob,'Carved arcade',light,part,.008)
 for yy in [-1.06,0,1.06]:box('Arcade stone foot',(x,yy,.35),(.22,.14,.28),marble,part,.012)
 part='BridgeLeftPier' if side<0 else 'BridgeRightPier'
 box('Square pier',(x,1.06,.62),(.29,.25,1.0),marble,part,.022)
 box('Pier foot',(x,1.06,.26),(.42,.38,.14),light,part,.018)
 box('Pier capital',(x,1.06,1.19),(.44,.4,.11),light,part,.018)
 box('Pier gilt molding',(x,1.06,1.26),(.36,.32,.045),gold,part,.008)
 lathe('Carved pier urn',x,1.06,1.29,[(0,.14),(.05,.18),(.10,.13),(.18,.16),(.27,.10),(.43,0)],gold,part,40)
# Fine arcade tracery spans rail panels; gold follows the carved stone reveal.
for side in [-1,1]:
 part='BridgeLeftRail' if side<0 else 'BridgeRightRail';x=side*4.04
 for cy in [-.55,.55]:
  for xx,r,m in [(x-side*.105,.006,gold)]:
   tube('Arcade leaf tracery',[(xx,cy+math.cos(i/32*math.pi)*.45,.42+math.sin(i/32*math.pi)*.55) for i in range(33)],r,m,part)
  for sy in [-1,1]:
   tube('Carved fan leaf',[(x-side*.15,cy,.63),(x-side*.15,cy+sy*.10,.75),(x-side*.15,cy+sy*.18,.70)],.012,gold,part)
# Open semicircular overlook: flat edge joins the road, curved edge faces the clouds.
part='PortalTerrace'
def terrace(name,r,z,depth,m):
 verts=[(-r,-2.25,z),(r,-2.25,z)]+[(math.cos(i/64*math.pi)*r,-2.25+math.sin(i/64*math.pi)*r,z) for i in range(65)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[tuple(range(len(verts)))]);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob)
 solid=ob.modifiers.new('Stone thickness','SOLIDIFY');solid.thickness=depth;bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=solid.name)
 return finish(ob,name,m,part,.018)
terrace('Semicircular cantilever foundation',4.35,-.07,.42,shadow)
terrace('Polished semicircular marble terrace',4.27,.025,.13,marble)
for r,z in [(4.3,-.12),(4.18,.045),(3.98,.046)]:
 tube('Curving terrace gilt border',[(math.cos(i/96*math.pi)*r,-2.25+math.sin(i/96*math.pi)*r,z) for i in range(97)],.014,gold,part)
for j in range(23):
 a=(j+.5)/23*math.pi;x=math.cos(a)*4.13;y=-2.25+math.sin(a)*4.13
 lathe('Terrace carved baluster',x,y,.14,[(0,.10),(.07,.11),(.18,.06),(.40,.09),(.64,.045),(.82,.085),(.9,.09)],light,part,32)
 if j%4==0:
  box('Terrace carved pier',(x,y,.64),(.28,.28,1.12),marble,part,.025)
  lathe('Terrace golden finial',x,y,1.25,[(0,.12),(.05,.15),(.15,.11),(.27,.06),(.36,0)],gold,part,32)
for z,r,t,m in [(.15,4.16,.095,light),(1.13,4.16,.09,marble),(1.24,4.16,.015,gold)]:
 tube('Continuous semicircular balustrade',[(math.cos(i/96*math.pi)*r,-2.25+math.sin(i/96*math.pi)*r,z) for i in range(97)],t,m,part)
# Freestanding carved portal: separate from the terrace so it can face the viewer.
part='Portal'
for x in [-PROFILE['jambCenter'],PROFILE['jambCenter']]:
 for z,w,d,h,m in [(.17,.72,.74,.30,light),(.38,.57,.60,.12,gold),(2.2,.35,.44,3.55,marble),(4.05,.62,.64,.18,light),(4.19,.55,.57,.08,gold)]:
  box('Layered carved door jamb',(x,.78,z),(w,d,h),m,part,.018)
 for dx in [-.13,.13]:tube('Fine vertical gilt channel',[(x+dx,.535,.46),(x+dx,.535,4.02)],.012,gold,part)
 for z in [.75,1.45,2.15,2.85,3.55]:
  tube('Carved climbing leaf',[(x,.52,z-.22),(x-.10,.50,z),(x,.51,z+.20),(x+.10,.50,z),(x,.52,z-.22)],.018,light,part)
 lathe('Door pinnacle',x,.78,4.23,[(0,.19),(.12,.22),(.22,.13),(.55,.07),(.84,0)],gold,part,32)
for r,t,m,y in [(PROFILE['archRadius'],PROFILE['stoneRadius'],marble,PROFILE['depth']),(1.43,.055,light,.78),(1.25,.027,gold,.575),(1.48,.018,gold,.56)]:
 tube('Sculpted pointed archivolt',[(math.cos(i/64*math.pi)*r,y,PROFILE['springHeight']+math.sin(i/64*math.pi)*r*PROFILE['archStretch']) for i in range(65)],t,m,part)
for j in range(13):
 a=(j+.5)/13*math.pi
 leaf=sphere('Archivolt carved rosette',(math.cos(a)*1.43,.53,4.10+math.sin(a)*1.43*1.24),(.065,.045,.11),gold,part);leaf.rotation_euler.y=a
for r in [1.03,.84]:tube('Terrace compass inlay',[(math.cos(i/64*math.tau)*r,-.8+math.sin(i/64*math.tau)*r,.047) for i in range(65)],.009,inlay,part)
lathe('Door crown jewel',0,.78,5.65,[(0,.08),(.23,.22),(.50,.07),(.72,0)],gold,part,32)
# Broad bas-relief panels on front AND sides prevent blank rectangular jambs.
for sx in [-1,1]:
 x=sx*1.23
 for face in [-1,1]:
  y=.78+face*.235
  for z in [1.0,1.85,2.7,3.55]:
   for sign in [-1,1]:
    tube('Acanthus scroll relief',[(x,y,z-.28),(x+sign*.11,y+face*.018,z-.12),(x+sign*.10,y+face*.024,z+.08),(x+sign*.035,y+face*.018,z+.18)],.015,gold,part)
   sphere('Carved relief pearl',(x,y+face*.02,z),(.037,.025,.065),light,part)
 for z in [.72,1.55,2.38,3.21]:
  tube('Side jamb diamond relief',[(x+sx*.19,.78,z-.18),(x+sx*.20,.64,z),(x+sx*.19,.78,z+.18),(x+sx*.20,.92,z),(x+sx*.19,.78,z-.18)],.012,gold,part)
 # Swept gilded wing at the spring of the arch.
 tube('Swept outer wing',[(x,.78,4.20),(x+sx*.34,.78,4.48),(x+sx*.48,.78,4.98),(x+sx*.32,.78,5.24)],.045,gold,part)
 for j in range(4):
  z=4.30+j*.15
  tube('Wing leaf filigree',[(x+sx*.10,.75,z),(x+sx*(.32+j*.03),.75,z+.14),(x+sx*.20,.75,z+.25)],.018,light,part)
# Four-point faceted crown with a luminous central jewel.
for sign in [-1,1]:
 tube('Crown star contour',[(0,.50,6.30),(sign*.13,.50,5.92),(sign*.37,.50,5.80),(sign*.13,.50,5.67),(0,.50,5.28)],.028,gold,part)
sphere('Crown inset sky crystal',(0,.49,5.80),(.10,.065,.22),crystal,part)


# Solid cut gemstone star with alternating facets, readable from the road.
star_outline=[(0,6.40),(.12,5.96),(.42,5.80),(.12,5.64),(0,5.23),(-.12,5.64),(-.42,5.80),(-.12,5.96)]
verts=[(0,.35,5.80)]+[(x,.49,z) for x,z in star_outline]
faces=[(0,i+1,(i+1)%8+1) for i in range(8)]
me=bpy.data.meshes.new('Faceted crown star');me.from_pydata(verts,[],faces);me.update()
ob=bpy.data.objects.new('Solid golden crown star',me);bpy.context.collection.objects.link(ob);finish(ob,'Solid golden crown star',gold,part)
ob.data.materials.append(light)
for i,f in enumerate(ob.data.polygons):f.material_index=i%2;f.use_smooth=False

# The aperture is exported alongside its frame, with the identical arch profile.
# Runtime substitutes its animated material, never reconstructs a different silhouette.
w=PROFILE['glassHalfWidth']; base=PROFILE['glassBottom']; spring=PROFILE['springHeight']; rise=PROFILE['glassRise']; depth=PROFILE['depth']
outline=[(-w,-depth,base),(w,-depth,base)]
# Blender depth is positive Y; glTF converts it to negative Z.
outline=[(-w,depth,base),(w,depth,base)]+[(math.cos(i/96*math.pi)*w,depth,spring+math.sin(i/96*math.pi)*rise) for i in range(97)]
verts=[(0,depth,(base+spring+rise)/2)]+outline
faces=[(0,i+1,(i+1)%len(outline)+1) for i in range(len(outline))]
me=bpy.data.meshes.new('Frame matched aperture');me.from_pydata(verts,[],faces);me.update()
uv=me.uv_layers.new(name='Portal UV')
for polygon in me.polygons:
 for loopindex in polygon.loop_indices:
  co=me.vertices[me.loops[loopindex].vertex_index].co
  uv.data[loopindex].uv=((co.x+w)/(2*w),(co.z-base)/(spring+rise-base))
ob=bpy.data.objects.new('PortalAperture',me);bpy.context.collection.objects.link(ob);finish(ob,'PortalAperture',crystal,'PortalAperture')
# Recessed luminous reveal follows all four sides and hides the glass edge.
part='Portal'
for sx in [-1,1]:
 tube('Glass retaining gilded reveal',[(sx*w,depth-.10,base),(sx*w,depth-.10,spring)],.022,gold,part)
tube('Glass arched retaining reveal',[(math.cos(i/96*math.pi)*w,depth-.10,spring+math.sin(i/96*math.pi)*rise) for i in range(97)],.022,gold,part)
tube('Glass lower retaining reveal',[(-w,depth-.10,base),(w,depth-.10,base)],.025,gold,part)

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
