"""Original river traveler: editable Blender rig, idle/run actions, browser-ready GLB.
Run with Blender --background --python tools/blender/build_traveler.py
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
(ROOT / 'design').mkdir(exist_ok=True)
(ROOT / 'public/models').mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in bpy.data.materials:
    bpy.data.materials.remove(data)

def mat(name, color, metal=0, rough=.5):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    return m

ivory = mat('Ivory woven linen', (.87,.86,.77), 0,.7)
teal = mat('Deep teal silk', (.045,.22,.25), .08,.4)
lining = mat('Cape lining', (.14,.36,.37), 0,.6)
gold = mat('Brushed champagne gold', (.67,.46,.19), .72,.28)
leather = mat('Midnight leather', (.028,.065,.085), .06,.57)
skin = mat('Warm porcelain skin', (.81,.59,.43), 0,.62)
hair = mat('Moon silver hair', (.78,.82,.8), .07,.34)
hairshade = mat('Silver strand shadows', (.45,.56,.58), .05,.47)
eye = mat('Teal eyes', (.025,.23,.24), .1,.2)
black = mat('Pupil', (.01,.02,.025),0,.4)

# Real skeleton with limb and cape bones, glTF compatible.
arm_data = bpy.data.armatures.new('TravelerSkeleton')
rig = bpy.data.objects.new('RiverTravelerRig', arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent: b.parent = arm_data.edit_bones[parent]
    return b
bone('root',(0,0,0),(0,0,.2))
bone('pelvis',(0,0,.88),(0,0,1.06),'root')
bone('spine',(0,0,1.06),(0,0,1.32),'pelvis')
bone('chest',(0,0,1.32),(0,0,1.55),'spine')
bone('neck',(0,0,1.55),(0,0,1.71),'chest')
bone('head',(0,0,1.71),(0,0,2.04),'neck')
bone('cape',(0,-.13,1.48),(0,-.23,1.03),'chest')
bone('cape_tip',(0,-.23,1.03),(0,-.36,.53),'cape')
for side, x in [('L',1),('R',-1)]:
    bone('upper_arm.'+side,(x*.25,0,1.49),(x*.37,.015,1.22),'chest')
    bone('forearm.'+side,(x*.37,.015,1.22),(x*.39,.06,1.00),'upper_arm.'+side)
    bone('hand.'+side,(x*.39,.06,1.00),(x*.395,.075,.91),'forearm.'+side)
    bone('thigh.'+side,(x*.125,0,.92),(x*.135,.015,.51),'pelvis')
    bone('shin.'+side,(x*.135,.015,.51),(x*.135,0,.12),'thigh.'+side)
    bone('foot.'+side,(x*.135,0,.12),(x*.135,.16,.065),'shin.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.select_set(False)

meshes=[]
def finish(o, material, bind='chest', smooth=True):
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    if smooth:
        for f in o.data.polygons: f.use_smooth=True
    o.parent=rig
    mod=o.modifiers.new('Traveler skin','ARMATURE'); mod.object=rig
    if isinstance(bind,str):
        g=o.vertex_groups.new(name=bind); g.add(list(range(len(o.data.vertices))),1,'REPLACE')
    else:
        for b in set(bind(v.co) for v in o.data.vertices): o.vertex_groups.new(name=b)
        for v in o.data.vertices: o.vertex_groups[bind(v.co)].add([v.index],1,'REPLACE')
    meshes.append(o)
    o.select_set(False)
    return o

def uv(name, loc, scale, material, bind='chest', segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    return finish(o,material,bind)

def rings(name, profiles, material, bind='chest', n=32):
    # Profiles: z, x-radius, y-radius, y-center. Tailored surfaces, not primitive stand-ins.
    verts=[]
    for z,rx,ry,cy in profiles:
        for j in range(n):
            a=j*math.tau/n; verts.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    faces=[]
    for i in range(len(profiles)-1):
        for j in range(n):
            k=i*n+j; faces.append((k,i*n+(j+1)%n,(i+1)*n+(j+1)%n,k+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple((len(profiles)-1)*n+j for j in range(n))])
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    return finish(o,material,bind)

def link(name,a,b,r1,r2,material,bind,vertices=20):
    d=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=d.length, location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,material,bind)

def ribbon(name,points,radius,material,bind='chest'):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=8; c.bevel_depth=radius; c.bevel_resolution=3
    sp=c.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for p,co in zip(sp.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o=bpy.context.object
    return finish(o,material,bind)

# Layered tailored outfit with waist and shoulder details.
rings('Ivory fitted tunic',[(1.0,.19,.12,0),(1.12,.16,.115,0),(1.30,.205,.135,0),(1.44,.25,.13,0),(1.50,.18,.11,0)],ivory,lambda p:'spine' if p.z<1.32 else 'chest')
rings('Teal corset',[(1.04,.195,.127,0),(1.10,.172,.12,0),(1.19,.174,.121,0)],teal,'spine')
rings('Champagne waist sash',[(1.035,.20,.13,0),(1.065,.20,.13,0)],gold,'pelvis')
rings('Layered ivory skirt',[(.77,.30,.21,0),(.81,.28,.20,0),(.98,.215,.15,0),(1.04,.19,.13,0)],ivory,'pelvis')
for x in [-1,1]:
    ribbon('Gold tunic seam',[(x*.14,.105,1.08),(x*.155,.13,1.27),(x*.12,.105,1.47)],.006,gold,'chest')
    link('Shoulder mantle',(x*.16,0,1.49),(x*.29,-.005,1.47),.14,.115,teal,'chest')
    ribbon('Shoulder gold trim',[(x*.12,-.1,1.51),(x*.24,-.10,1.50),(x*.32,-.04,1.47)],.009,gold)
uv('Neck',(0,0,1.61),(.073,.073,.125),skin,'neck')
uv('Face',(0,.014,1.81),(.155,.138,.205),skin,'head',32)
uv('Nose',(0,.147,1.79),(.024,.035,.035),skin,'head',20)
for side in [-1,1]:
    uv('Ear',(side*.15,.006,1.80),(.028,.028,.052),skin,'head')
    uv('Eye white',(side*.058,.134,1.83),(.037,.014,.027),ivory,'head')
    uv('Iris',(side*.058,.146,1.83),(.016,.006,.021),eye,'head')
    uv('Pupil',(side*.058,.151,1.832),(.006,.003,.014),black,'head')
    uv('Eyelight',(side*.052,.155,1.839),(.004,.002,.006),ivory,'head',12)
# Sculpted crown with curved tapered hair locks, separate back strands.
uv('Silver hair crown',(0,-.014,1.88),(.17,.15,.17),hair,'head',32)
for i in range(15):
    a=math.pi + i/14*math.pi
    x=.145*math.cos(a); y=.12*math.sin(a)
    ribbon('Flowing silver lock',[(x,y,1.91),(x*1.1,y-.04,1.79),(x*1.18,y-.045,1.61),(x*1.35,y-.015,1.50+(i%3)*.025)],.027 if i%2 else .032,hair if i%3 else hairshade,'head')
for side in [-1,1]:
    ribbon('Face framing hair',[(side*.11,.09,1.96),(side*.147,.12,1.83),(side*.153,.09,1.64),(side*.17,.045,1.60)],.024,hair,'head')
    ribbon('Swept fringe',[(side*.01,.11,2.00),(side*.07,.147,1.94),(side*.125,.13,1.84)],.025,hair,'head')
    uv('Gold hair rosette',(side*.153,.04,1.90),(.028,.016,.028),gold,'head')
    link('Hair pin',(side*.155,.025,1.92),(side*.18,-.01,1.78),.008,.004,gold,'head',12)

for side,x in [('L',1),('R',-1)]:
    up='upper_arm.'+side; fore='forearm.'+side; hand='hand.'+side
    thigh='thigh.'+side; shin='shin.'+side; foot='foot.'+side
    link('Ivory upper sleeve',(x*.255,0,1.46),(x*.37,.015,1.23),.068,.096,ivory,up)
    uv('Elbow',(x*.37,.015,1.22),(.064,.064,.067),skin,fore)
    link('Silk forearm sleeve',(x*.37,.02,1.22),(x*.39,.06,1.04),.056,.068,ivory,fore)
    link('Gold cuff',(x*.39,.055,1.06),(x*.39,.06,1.025),.063,.063,gold,fore)
    uv('Hand',(x*.394,.075,.978),(.046,.034,.074),skin,hand)
    for f in range(4):
        link('Finger',(x*(.366+f*.016),.082,.95),(x*(.368+f*.016),.09,.915),.009,.007,skin,hand,10)
    link('Leg',(x*.125,0,.91),(x*.135,.015,.5),.067,.09,skin,thigh)
    uv('Knee',(x*.135,.015,.52),(.065,.066,.074),skin,shin)
    link('Tall teal boot',(x*.135,.012,.48),(x*.135,0,.115),.062,.079,leather,shin)
    link('Boot gold collar',(x*.135,.012,.48),(x*.135,.011,.455),.081,.081,gold,shin)
    uv('Boot foot',(x*.135,.073,.075),(.077,.145,.071),leather,foot)
    uv('Champagne toe cap',(x*.135,.177,.075),(.071,.052,.052),gold,foot)
    ribbon('Boot embroidery',[(x*.135,.077,.44),(x*.125,.076,.32),(x*.145,.071,.2)],.0045,gold,shin)

# Two-layer cape, cut hem, scalloped border and gold embroidered stars.
def cape_mesh(name, material, dy=0):
    rows,cols=16,20; verts=[]
    for row in range(rows):
        t=row/(rows-1); z=1.49-t*.89
        width=.24+t*.16; y=-.135-t*.19+dy
        for col in range(cols):
            u=col/(cols-1)*2-1
            zz=z+(abs(u)*.08 if row==rows-1 else 0)
            verts.append((u*width,y-.025*math.cos(u*math.pi*4)*(t+.1),zz))
    faces=[]
    for i in range(rows-1):
        for j in range(cols-1):
            k=i*cols+j; faces.append((k,k+1,k+cols+1,k+cols))
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    return finish(o,material,lambda p:'cape' if p.z>1.0 else 'cape_tip')
cape_mesh('Teal outer cloak',teal,-.009); cape_mesh('Pale silk cloak lining',lining,.007)
for side in [-1,1]:
    ribbon('Cape embroidered edge',[(side*.24,-.15,1.48),(side*.29,-.24,1.19),(side*.34,-.29,.95),(side*.40,-.335,.68)],.008,gold,'cape')
ribbon('Cape gold hem',[(-.4,-.34,.68),(-.22,-.35,.615),(0,-.35,.60),(.22,-.35,.615),(.4,-.34,.68)],.009,gold,'cape_tip')
for cx,cz,r in [(0,1.29,.075),(-.16,.96,.035),(.17,.82,.045),(0,.73,.027)]:
    b='cape' if cz>1 else 'cape_tip'
    ribbon('Four point star embroidery',[(cx,-.37,cz+r),(cx+r*.32,-.37,cz+r*.26),(cx+r,-.37,cz),(cx+r*.25,-.37,cz-r*.25),(cx,-.37,cz-r),(cx-r*.25,-.37,cz-r*.25),(cx-r,-.37,cz),(cx-r*.25,-.37,cz+r*.25),(cx,-.37,cz+r)],.004,gold,b)
uv('Moon clasp',(0,-.16,1.49),(.045,.018,.045),gold,'chest')
uv('Teal clasp jewel',(0,-.181,1.49),(.023,.009,.025),teal,'chest')
# Satchel adds a readable asymmetric silhouette from the back.
uv('Traveler satchel',(.245,-.10,.99),(.10,.065,.13),leather,'pelvis')
ribbon('Satchel strap',[(.20,.06,1.45),(.09,.14,1.3),(-.1,.12,1.17),(.24,-.17,1.01)],.013,gold,'chest')
uv('Satchel clasp',(.245,-.16,1.01),(.018,.009,.02),gold,'pelvis')

# Author two cyclic, in-place skeletal actions. Translation stays at the origin.
scene=bpy.context.scene; scene.render.fps=30
rig.animation_data_create()
def make_action(name, frames):
    act=bpy.data.actions.new(name); act.use_fake_user=True; rig.animation_data.action=act
    for f in frames:
        scene.frame_set(f)
        t=(f-1)/24*math.tau
        for p in rig.pose.bones:
            p.rotation_mode='XYZ'; p.rotation_euler=(0,0,0); p.location=(0,0,0)
        if name=='Run':
            rig.pose.bones['pelvis'].location.z=abs(math.sin(t))*.034
            rig.pose.bones['spine'].rotation_euler.x=.075
            for i,side in enumerate(['L','R']):
                a=t+i*math.pi
                rig.pose.bones['thigh.'+side].rotation_euler.x=math.sin(a)*.73
                rig.pose.bones['shin.'+side].rotation_euler.x=-.28-max(0,-math.sin(a))*.85
                rig.pose.bones['foot.'+side].rotation_euler.x=.12+math.sin(a)*.15
                rig.pose.bones['upper_arm.'+side].rotation_euler.x=-math.sin(a)*.55
                rig.pose.bones['forearm.'+side].rotation_euler.x=.65+math.sin(a)*.15
            rig.pose.bones['cape'].rotation_euler.x=-.18+math.sin(t)*.04
            rig.pose.bones['cape_tip'].rotation_euler.x=-.15+math.sin(t+.6)*.08
        else:
            rig.pose.bones['chest'].rotation_euler.x=math.sin(t)*.012
            rig.pose.bones['head'].rotation_euler.z=math.sin(t*.5)*.012
            rig.pose.bones['cape_tip'].rotation_euler.x=math.sin(t)*.025
        for p in rig.pose.bones:
            p.keyframe_insert('rotation_euler',frame=f,group=p.name)
            p.keyframe_insert('location',frame=f,group=p.name)
    return act
idle=make_action('Idle',[1,7,13,19,25]); run=make_action('Run',list(range(1,26,2))+[25])
rig.animation_data.action=idle
scene.frame_start=1; scene.frame_end=25; scene.frame_set(1)
# Only actual character objects go into the web asset.
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/river-traveler.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False,export_yup=True)
# Editable native source, with a useful portrait camera and studio lighting.
bpy.ops.object.camera_add(location=(3,-5,2.6)); cam=bpy.context.object; cam.name='Model preview'; target=Vector((0,0,1.1)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=2.65; scene.camera=cam
for loc,power,size in [((2,-3,4),450,4),((-2,-1,3),220,3),((0,3,3),350,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); lamp=bpy.context.object; lamp.data.energy=power; lamp.data.shape='DISK'; lamp.data.size=size; lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.16,.2,.24)
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=700; scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
scene.render.filepath=str(ROOT/'outputs/river-traveler-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/river-traveler.blend'))
bpy.ops.render.render(write_still=True)
print('RIVER_MODEL_READY',len(meshes),'mesh parts',len(rig.data.bones),'bones',[(a.name,a.frame_range[:]) for a in bpy.data.actions])
