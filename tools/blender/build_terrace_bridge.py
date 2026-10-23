"""v9: broad semicircular belvedere, fitted paving and carved arcades.

Keep the reference portal from v8; replace every road/terrace component.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'design/river-architecture-v8.blend'))
for o in list(bpy.context.scene.objects):
    if o.name not in ['Portal','PortalAperture']:
        bpy.data.objects.remove(o,do_unlink=True)
for data in list(bpy.data.meshes):
    if data.users==0:bpy.data.meshes.remove(data)
for data in list(bpy.data.materials):
    if data.users==0:bpy.data.materials.remove(data)

def material(name,color,metal=0,rough=.35,image=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    if image:
        t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=image;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m
def image(path):
    im=bpy.data.images.load(str(ROOT/path),check_existing=True);im.pack();return im
stone_image=image('public/art/river-ivory-marble-v4.png')
floor_image=image('design/river-assets-v8/paving-v9.png')
frame_image=image('design/river-assets-v8/portal-frame.png')
stone=material('Reference terrace',(.78,.72,.61),.03,.30,stone_image)
trim=material('Honed warm limestone',(.66,.61,.51),.04,.4,stone_image)
gold=material('Champagne gold v9',(.64,.43,.16),.78,.26)
recess=material('Warm recessed stone v9',(.38,.36,.31),0,.58)
paving=material('Reference paving',(.77,.73,.64),.06,.28,floor_image)
carving=material('Pier carved leaf panels',(.8,.74,.62),.23,.36,frame_image)
gem=material('Lotus stone crystal',(.62,.69,.64),.30,.23)
parts={}
def finish(o,name,m,part,bevel=0):
    o.name=name;o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('Soft carved edges','BEVEL');b.width=bevel;b.segments=3
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    parts.setdefault(part,[]).append(o)
    return o
def box(name,loc,size,m,part,bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return finish(o,name,m,part,bevel)
def mesh(name,verts,faces,m,part):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,m,part)
def tube(name,points,r,m,part):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=5;c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,m,part)
def uv_world(o,scale=3):
    uv=o.data.uv_layers.new(name='Stone coordinates')
    for p in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(p.normal[i]));a,b=[i for i in range(3) if i!=axis]
        for li in p.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(co[a]/scale,co[b]/scale)

# Eight metre carriageway, four individually beveled slabs across each module.
part='BridgeRoad'
box('Structural bridge bed',(0,0,-.25),(8.3,2.2,.42),recess,part,.04)
box('Lower projecting cornice',(0,0,-.40),(8.5,2.2,.10),trim,part,.025)
for x in [-3,-1,1,3]:
    o=box('Fitted ivory paving',(x,0,-.035),(1.986,2.188,.13),paving,part,.012)
    uv=o.data.uv_layers.new(name='Four-module reference paving')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=((co.x+4)/8,(co.y+1.1)/8.8)
for side in [-1,1]:
    box('Honed bridge curb',(side*4.1,0,.005),(.25,2.2,.19),trim,part,.025)
    box('Fine edge inlay',(side*4.19,0,.10),(.012,2.2,.012),gold,part,.003)

def rail(side):
    part='BridgeLeftRail' if side<0 else 'BridgeRightRail';x=side*4.1
    box('Arcade base molding',(x,0,.16),(.36,2.2,.23),trim,part,.025)
    box('Wide beveled handrail',(x,0,1.09),(.43,2.2,.16),stone,part,.032)
    box('Inset gilded handrail seam',(x-side*.18,0,1.11),(.008,2.2,.018),gold,part,.003)
    for cy in [-.55,.55]:
        n=37;verts=[]
        for xx in [x-.115,x+.115]:
            for rx,rz in [(.55,.73),(.425,.58)]:
                for k in range(n):
                    a=k/(n-1)*math.pi;verts.append((xx,cy+math.cos(a)*rx,.27+math.sin(a)*rz))
        faces=[]
        for k in range(n-1):
            faces.extend([(k,k+1,n+k+1,n+k),(2*n+k,3*n+k,3*n+k+1,2*n+k+1),(k,2*n+k,2*n+k+1,k+1),(n+k,n+k+1,3*n+k+1,3*n+k)])
        faces.extend([(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)])
        o=mesh('Sculpted open stone arch',verts,faces,trim,part)
        for face in [-1,1]:
            tube('Inset arch gilding',[(x+face*.119,cy+math.cos(k/64*math.pi)*.438,.27+math.sin(k/64*math.pi)*.598) for k in range(65)],.0055,gold,part)
    for yy in [-1.07,0,1.07]:box('Square arcade foot',(x,yy,.34),(.24,.13,.29),stone,part,.012)
    return part
def pier(side):
    part='BridgeLeftPier' if side<0 else 'BridgeRightPier';x=side*4.1;y=1.06
    for z,w,h,m in [(.13,.53,.18,trim),(.27,.45,.10,stone),(.67,.34,.75,stone),(1.06,.47,.09,trim),(1.16,.56,.12,stone),(1.24,.43,.045,gold)]:
        box('Layered square pier',(x,y,z),(w,w,h),m,part,.018)
    # Source-matched carved panels sit in shallow recesses on all four sides.
    for face in range(4):
        a=face*math.pi/2
        pts=[(-.13,-.18,.33),(.13,-.18,.33),(.13,-.18,.99),(-.13,-.18,.99)]
        verts=[(x+math.cos(a)*u-math.sin(a)*v,y+math.sin(a)*u+math.cos(a)*v,z) for u,v,z in pts]
        o=mesh('Gold leaf pier relief',verts,[(0,1,2,3)],carving,part);uv=o.data.uv_layers.new(name='Carved pillar detail')
        coords=[(.153,.25),(.29,.25),(.29,.66),(.153,.66)]
        for p in o.data.polygons:
            for li in p.loop_indices:uv.data[li].uv=coords[o.data.loops[li].vertex_index]
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,1.47));o=bpy.context.object;o.scale=(.145,.145,.22);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);finish(o,'Faceted lotus seed',gem,part)
    for j in range(8):
        a=j/8*math.tau;verts=[]
        for k in range(13):
            t=k/12;r=.16*math.sin(math.pi*t*.85)+.045;z=1.29+t*.38;width=.048*math.sin(math.pi*t)
            for s in [-1,0,1]:
                rr=r+(.018 if s==0 else 0);verts.append((x+math.cos(a)*rr-math.sin(a)*width*s,y+math.sin(a)*rr+math.cos(a)*width*s,z))
        faces=[]
        for k in range(12):
            for l in [0,1]:i=k*3+l;faces.append((i,i+1,i+4,i+3))
        o=mesh('Sculpted gilded lotus petal',verts,faces,gold,part)
        for f in o.data.polygons:f.use_smooth=True
    return part
for side in [-1,1]:rail(side);pier(side)

# A generous six-metre-radius semicircular belvedere with a clear entrance.
part='PortalTerrace';R=6.15;CY=-2.25
def disk(name,r,z,depth,mat):
    verts=[(0,CY,z)]+[(math.cos(i/120*math.pi)*r,CY+math.sin(i/120*math.pi)*r,z) for i in range(121)]
    o=mesh(name,verts,[(0,i+1,i+2) for i in range(120)],mat,part)
    mod=o.modifiers.new('Solid stone slab','SOLIDIFY');mod.thickness=depth;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
disk('Belvedere structural base',R,-.15,.48,recess)
disk('Lower carved cornice',R+.08,-.41,.11,trim)
disk('Beveled terrace apron',R-.04,-.065,.12,trim)
for j in range(12):
    for r0,r1 in [(0.01,2.8),(2.815,5.98)]:
        a0=j/12*math.pi+.001;a1=(j+1)/12*math.pi-.001
        pts=[]
        for r,rev in [(r0,False),(r1,True)]:
            angles=[a0+(a1-a0)*k/12 for k in range(13)]
            if rev:angles.reverse()
            pts.extend([(math.cos(a)*r,CY+math.sin(a)*r,.035) for a in angles])
        o=mesh('Radial cut ivory terrace slab',pts,[tuple(reversed(range(len(pts))))],stone,part)
        solid=o.modifiers.new('Paver thickness','SOLIDIFY');solid.thickness=.08;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
for r in [5.83,5.70]:tube('Double champagne terrace inlay',[(math.cos(i/120*math.pi)*r,CY+math.sin(i/120*math.pi)*r,.044) for i in range(121)],.009,gold,part)
for r in [1.25,1.12]:tube('Entry compass ring',[(math.cos(i/96*math.tau)*r,-.15+math.sin(i/96*math.tau)*r,.046) for i in range(97)],.009,gold,part)
points=[]
for i in range(17):
    a=i/16*math.tau;r=1.02 if i%2==0 else .25;points.append((math.cos(a)*r,-.15+math.sin(a)*r,.046))
tube('Entry compass rose',points,.009,gold,part)
# Bend the NEW arcade around the bay; no turned balusters or old rail meshes.
for j in range(9):
    for source in parts['BridgeLeftRail']:
        o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);parts[part].append(o)
        for v in o.data.vertices:
            radius=5.97+v.co.x+4.1;a=(j+.5)*math.pi/9+v.co.y/2.2*math.pi/9
            v.co.x=math.cos(a)*radius;v.co.y=CY+math.sin(a)*radius
        o.data.update()
for j in range(7):
    for source in parts['BridgeLeftPier']:
        o=source.copy();o.data=source.data.copy();bpy.context.collection.objects.link(o);parts[part].append(o);a=j/6*math.pi
        for v in o.data.vertices:
            u,vv=v.co.x+4.1,v.co.y-1.06;v.co.x=math.cos(a)*(5.97+u)-math.sin(a)*vv;v.co.y=CY+math.sin(a)*(5.97+u)+math.cos(a)*vv
        o.data.update()
# UVs are actual object coordinates; procedural primitives never get one flat
# texture pixel or a stretched solid colour in the web renderer.
for name,objects in parts.items():
    for o in objects:
        if not o.data.uv_layers:uv_world(o,3.4)
    parent=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(parent)
    # Consolidate by material, keeping the paving separate for instanced UVs.
    bymat={}
    for o in objects:bymat.setdefault(o.data.materials[0],[]).append(o)
    for m,group in bymat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name=name+' '+m.name;o.parent=parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/river-architecture-v9.glb'),export_format='GLB',use_selection=True,export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/river-architecture-v9.blend'))
print('BELVEDERE_READY',{'radius':R,'roadWidth':8,'arcadeSegments':9,'piers':7})
