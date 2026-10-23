"""Reference-textured, volumetric skinned characters for River of Time.

Uses the generated front/back turnarounds as projection textures on shaped body
volumes, with separate cloth surfaces and in-place skeletal animation. These are
authored game meshes, not a claim of recovering an unseen original sculpt.
Run: Blender --background --python tools/blender/build_pair_characters.py
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'design/river-characters-v1'
OUT = ROOT / 'public/models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

PROFILES = {
    'alexx': {
        'center': 817, 'front': 301, 'floor': 995, 'height': 2.20,
        'head': (22, 165, 741, 894, 228, 376),
        'torso': [(128,775,862,263,345,.070),(158,737,899,226,383,.115),(192,705,924,190,416,.145),(242,723,909,203,399,.145),(305,741,894,219,386,.120),(357,740,894,221,386,.110),(396,731,904,211,394,.125),(448,719,918,203,402,.135),(492,738,900,215,389,.120),(530,765,871,244,360,.095)],
        'arm_l': [(184,675,724,390,436,.075),(220,656,716,405,449,.073),(280,641,701,420,464,.065),(332,631,688,433,480,.065),(371,631,681,445,487,.057),(414,620,665,460,500,.047),(455,610,653,470,512,.044),(487,603,651,475,523,.043),(515,609,645,481,517,.030),(544,616,635,492,506,.015)],
        'arm_r': [(184,907,956,166,213,.075),(220,924,975,149,197,.073),(280,940,995,127,183,.065),(332,956,1011,116,171,.065),(371,967,1017,116,162,.057),(414,982,1028,107,148,.047),(455,993,1036,95,135,.044),(487,992,1043,83,133,.043),(515,997,1037,87,127,.030),(544,1007,1027,102,120,.015)],
        'leg_l': [(471,734,803,300,388,.090),(525,728,805,316,400,.095),(585,719,802,326,407,.086),(654,709,790,335,416,.077),(713,699,781,342,422,.073),(781,690,774,349,429,.072),(850,681,768,352,433,.068),(905,680,760,354,434,.083),(958,671,762,353,455,.120),(992,678,753,359,456,.120)],
        'leg_r': [(471,828,900,211,300,.090),(525,829,913,201,284,.095),(585,837,922,191,276,.086),(654,846,929,183,267,.077),(713,852,938,174,260,.073),(781,859,944,167,254,.072),(850,864,951,163,249,.068),(905,869,955,155,244,.083),(958,869,973,123,229,.120),(992,878,963,123,222,.120)],
        'coat_l': [(741,376),(791,392),(776,527),(733,657),(692,799),(634,908),(590,810),(636,657),(687,487)],
        'coat_r': [(848,391),(900,376),(945,493),(987,645),(1045,807),(1007,914),(947,792),(905,659),(861,528)],
        'joints': {'hip_l':(769,488),'knee_l':(750,700),'ankle_l':(721,934),'shoulder_l':(708,192),'elbow_l':(662,348),'wrist_l':(629,481),'hip_r':(863,488),'knee_r':(899,700),'ankle_r':(921,934),'shoulder_r':(924,192),'elbow_r':(983,348),'wrist_r':(1015,481)},
    },
    'bv': {
        'center': 776, 'front': 317, 'floor': 1000, 'height': 2.12,
        'head': (16, 172, 682, 863, 227, 414),
        'torso': [(139,735,820,284,352,.060),(171,701,852,254,380,.105),(207,690,864,231,408,.130),(260,703,850,250,389,.120),(309,714,839,264,378,.100),(350,715,838,259,383,.105),(389,698,855,242,401,.120),(439,692,862,230,412,.135),(482,708,849,238,403,.125),(515,730,826,261,382,.100)],
        'arm_l': [(179,669,710,388,424,.062),(218,657,702,399,436,.061),(267,639,686,413,451,.055),(320,618,664,435,473,.048),(363,603,644,451,487,.045),(406,583,628,469,511,.041),(447,573,615,481,522,.039),(481,567,609,486,526,.032),(524,575,594,493,511,.014)],
        'arm_r': [(179,841,884,202,242,.062),(218,850,898,186,231,.061),(267,869,913,168,213,.055),(320,889,934,145,188,.048),(363,912,950,130,168,.045),(406,927,967,116,154,.041),(447,941,981,104,144,.039),(481,941,983,102,140,.032),(524,955,970,113,128,.014)],
        'leg_l': [(471,700,765,317,395,.080),(524,693,766,326,402,.083),(578,688,759,333,409,.079),(644,682,751,337,412,.072),(710,676,745,343,413,.066),(778,671,737,348,410,.060),(841,670,729,353,405,.055),(903,671,728,354,404,.065),(960,653,738,350,420,.101),(998,662,734,356,417,.105)],
        'leg_r': [(471,789,852,240,318,.080),(524,789,860,231,309,.083),(578,794,867,223,301,.079),(644,802,873,217,291,.072),(710,808,879,211,281,.066),(778,814,881,210,275,.060),(841,820,879,214,271,.055),(903,820,881,214,273,.065),(960,815,900,199,281,.101),(998,819,895,207,279,.105)],
        'coat_l': [(699,382),(749,397),(721,521),(695,615),(658,741),(614,858),(573,812),(574,699),(626,584),(666,468)],
        'coat_r': [(807,395),(853,380),(888,464),(920,572),(973,695),(980,773),(946,828),(914,731),(884,622),(850,530)],
        'joints': {'hip_l':(733,485),'knee_l':(715,686),'ankle_l':(700,935),'shoulder_l':(693,190),'elbow_l':(643,320),'wrist_l':(593,459),'hip_r':(819,485),'knee_r':(841,686),'ankle_r':(856,935),'shoulder_r':(864,190),'elbow_r':(915,320),'wrist_r':(963,459)},
    },
}

def interpolate(rows, y):
    if y <= rows[0][0]: return rows[0][1:]
    if y >= rows[-1][0]: return rows[-1][1:]
    for a,b in zip(rows,rows[1:]):
        if a[0] <= y <= b[0]:
            t=(y-a[0])/(b[0]-a[0]);return [v+(w-v)*t for v,w in zip(a[1:],b[1:])]

def inside(x,y,poly):
    result=False
    j=len(poly)-1
    for i,(xi,yi) in enumerate(poly):
        xj,yj=poly[j]
        if ((yi>y)!=(yj>y)) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:result=not result
        j=i
    return result

def build(key,c):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials,bpy.data.armatures,bpy.data.actions):
        for data in list(collection):collection.remove(data)
    scene=bpy.context.scene;scene.render.fps=30
    image=bpy.data.images.load(str(SOURCE/f'{key}-turnaround.png'),check_existing=True)
    image.pack();w,h=image.size
    pixels=list(image.pixels[:])
    scale=c['height']/(c['floor']-c['head'][0])
    def pos(x,y,depth=0):return ((x-c['center'])*scale,depth,(c['floor']-y)*scale)
    def alpha(x,y):
        if not(0<=x<w and 0<=y<h):return 0
        return pixels[((h-1-int(y))*w+int(x))*4+3]
    def trace(y,lo,hi):
        hits=[x for x in range(int(lo),int(hi)) if alpha(x,y)>.65]
        return (min(hits),max(hits)) if hits else (lo,hi)

    material=bpy.data.materials.new(f'{key} reference cloth skin and hair');material.use_nodes=True
    bs=material.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.66
    bs.inputs['Metallic'].default_value=.07
    tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Linear'
    material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    # A small baked-light contribution preserves intricate black textile detail.
    material.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.28
    material.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
    material.surface_render_method='DITHERED'
    material.use_backface_culling=False
    rig_data=bpy.data.armatures.new(f'{key} skeleton');rig=bpy.data.objects.new(f'{key} character rig',rig_data);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    def bone(name,head,tail,parent=None):
        b=rig_data.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=rig_data.edit_bones[parent]
    bone('root',(0,0,0),(0,0,.15))
    bone('pelvis',pos(c['center'],510),pos(c['center'],400),'root')
    bone('spine',pos(c['center'],400),pos(c['center'],280),'pelvis')
    bone('chest',pos(c['center'],280),pos(c['center'],174),'spine')
    bone('neck',pos(c['center'],174),pos(c['center'],136),'chest')
    bone('head',pos(c['center'],136),pos(c['center'],27),'neck')
    bone('hair',pos(c['center'],135,-.11),pos(c['center'],260,-.15),'head')
    bone('hair_tip',pos(c['center'],260,-.15),pos(c['center'],380,-.14),'hair')
    for side in ['l','r']:
        j=c['joints'];p=lambda n:pos(*j[n+'_'+side])
        bone('upper_arm.'+side,p('shoulder'),p('elbow'),'chest')
        bone('forearm.'+side,p('elbow'),p('wrist'),'upper_arm.'+side)
        wx,wy=j['wrist_'+side];bone('hand.'+side,p('wrist'),pos(wx,wy+48),'forearm.'+side)
        bone('thigh.'+side,p('hip'),p('knee'),'pelvis')
        bone('shin.'+side,p('knee'),p('ankle'),'thigh.'+side)
        ax,ay=j['ankle_'+side];bone('foot.'+side,p('ankle'),pos(ax,c['floor']-10,.14),'shin.'+side)
        x=c['center']+(-64 if side=='l' else 64)
        bone('coat.'+side,pos(x,410,-.13),pos(x,620,-.15),'pelvis')
        bone('coat_tip.'+side,pos(x,620,-.15),pos(x,870,-.2),'coat.'+side)
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    meshes=[]
    def weights(part,y):
        def blend(names,points):
            for a,b,p in zip(names,names[1:],points):
                if y<p-24:return {a:1}
                if y<=p+24:
                    t=(y-p+24)/48;return {a:1-t,b:t}
            return {names[-1]:1}
        if part=='head':return {'head':1}
        if part=='torso':return blend(['chest','spine','pelvis'],[285,404])
        if part=='hair':return blend(['head','hair','hair_tip'],[160,270])
        side=part[-1]
        if part.startswith('arm'):return blend(['upper_arm.'+side,'forearm.'+side,'hand.'+side],[c['joints']['elbow_'+side][1],c['joints']['wrist_'+side][1]])
        if part.startswith('leg'):return blend(['thigh.'+side,'shin.'+side,'foot.'+side],[c['joints']['knee_'+side][1],c['joints']['ankle_'+side][1]])
        return blend(['pelvis','coat.'+side,'coat_tip.'+side],[430,650])
    def finish(name,verts,faces,uvs,ys,part):
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
        ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
        uv=me.uv_layers.new(name='Reference projection')
        for p in me.polygons:
            p.use_smooth=True
            for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
        groups={}
        for i,y in enumerate(ys):
            for name,weight in weights(part,y).items():
                if name not in groups:groups[name]=ob.vertex_groups.new(name=name)
                groups[name].add([i],weight,'REPLACE')
        ob.parent=rig;modifier=ob.modifiers.new('Smooth skeletal skin','ARMATURE');modifier.object=rig
        meshes.append(ob);return ob

    def volume(part,rows):
        verts=[];faces=[];uvs=[];ys=[];nr=max(14,int((rows[-1][0]-rows[0][0])/7));nc=33
        # Separate front/back hemispheres have independent, continuous UVs.
        for half in [-1,1]:
            base=len(verts)
            for r in range(nr+1):
                y=rows[0][0]+r/nr*(rows[-1][0]-rows[0][0]);left,right,fl,fr,depth=interpolate(rows,y)
                center=(left+right)*.5;radius=(right-left)*.5
                for i in range(nc):
                    angle=i/(nc-1)*math.pi
                    fraction=(1-math.cos(angle))*.5
                    x=left+fraction*(right-left)
                    # Rounded shoulders/limbs/head and shallow, tailored body.
                    bulge=math.sin(angle)**.64
                    dy=half*depth*bulge
                    if part.startswith('leg') and y>c['floor']-90:
                        dy += max(0,(y-(c['floor']-90))/90)*.045
                    if part=='head':dy+=.018
                    verts.append(pos(x,y,dy));ys.append(y)
                    u=(left+fraction*(right-left)) if half<0 else (fr-fraction*(fr-fl))
                    uvs.append((u/w,1-y/h))
            for r in range(nr):
                for i in range(nc-1):
                    a=base+r*nc+i;face=(a,a+1,a+1+nc,a+nc)
                    faces.append(face if half<0 else tuple(reversed(face)))
        # Both halves meet at every side vertex; caps close each body volume.
        other=(nr+1)*nc
        for r in [0,nr]:
            faces.append(tuple([r*nc+i for i in range(nc)]+[other+r*nc+i for i in range(nc-1,-1,-1)]))
        finish(f'{key} shaped {part}',verts,faces,uvs,ys,part)

    top,bottom,bl,br,fl,fr=c['head'];head=[]
    for y in range(top,bottom+1,5):
        l,r=trace(y,bl,br);fleft,fright=trace(y,fl,fr)
        t=(y-top)/(bottom-top);depth=.108*max(.25,math.sin(math.pi*min(.97,max(.03,t)))**.36)
        head.append((y,l,r,fleft,fright,depth))
    volume('head',head)
    for part in ['torso','arm_l','arm_r','leg_l','leg_r']:volume(part,c[part])

    def cloth(part,polygon,depth,front=False):
        verts=[];uvs=[];ys=[];faces=[];idx={};step=3
        xmin=int(min(p[0] for p in polygon));xmax=int(max(p[0] for p in polygon));ymin=int(min(p[1] for p in polygon));ymax=int(max(p[1] for p in polygon))
        for row,y in enumerate(range(ymin,ymax+step,step)):
            for col,x in enumerate(range(xmin,xmax+step,step)):
                if not inside(x,y,polygon):continue
                dy=depth+.025*math.sin(x*.095+y*.018)*(y-ymin)/max(1,ymax-ymin)
                if part=='hair':
                    # Continuous curved rear hair shell covers the scalp/neck seam.
                    width=max(24,90*math.sin(math.pi*min(.92,(y-ymin)/(ymax-ymin)+.12))**.3)
                    lateral=min(1,abs(x-c['center'])/width)
                    dy=-.174+.12*lateral*lateral+.009*math.sin(x*.13+y*.04)
                idx[row,col]=len(verts);verts.append(pos(x,y,dy));ys.append(y)
                u=(c['front']-(x-c['center'])) if front else x
                uvs.append((u/w,1-y/h))
        for (r,col),a in idx.items():
            ids=[idx.get((r,col+1)),idx.get((r+1,col+1)),idx.get((r+1,col))]
            if all(i is not None for i in ids):faces.append((a,*ids))
        ob=finish(f'{key} layered {part} '+('front' if front else 'back'),verts,faces,uvs,ys,part)
        solid=ob.modifiers.new('Cloth edge thickness','SOLIDIFY');solid.thickness=.002
    for side in ['l','r']:
        cloth('coat_'+side,c['coat_'+side],-.135)
    if key=='bv':
        cloth('hair',[(760,17),(798,17),(831,49),(847,93),(862,148),(876,230),(861,315),(825,370),(767,350),(704,373),(677,291),(689,201),(690,140),(710,66)],-.174)

    # Looping in-place animations. Cloth and hair have their own secondary bones.
    rig.animation_data_create()
    for name,frames in [('Idle',list(range(1,122,10))+[121]),('Run',list(range(1,26,2))+[25])]:
        action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
        for frame in frames:
            scene.frame_set(frame);phase=(frame-1)/(120 if name=='Idle' else 24)*math.tau
            for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
            rig.pose.bones['chest'].rotation_euler.x=math.sin(phase)*.008
            rig.pose.bones['head'].rotation_euler.z=math.sin(phase)*.012
            for n,side in enumerate(['l','r']):
                a=phase+n*math.pi;sign=1 if side=='l' else -1
                rig.pose.bones['upper_arm.'+side].rotation_euler.z=sign*-.18
                if name=='Run':
                    rig.pose.bones['pelvis'].location.z=.025+.025*math.cos(phase*2)
                    rig.pose.bones['spine'].rotation_euler.x=.045
                    rig.pose.bones['thigh.'+side].rotation_euler.x=math.sin(a)*.46
                    rig.pose.bones['shin.'+side].rotation_euler.x=-.18-max(0,-math.sin(a))*.62
                    rig.pose.bones['foot.'+side].rotation_euler.x=.11+math.sin(a)*.10
                    rig.pose.bones['upper_arm.'+side].rotation_euler.x=-math.sin(a)*.32
                    rig.pose.bones['forearm.'+side].rotation_euler.x=.35+math.sin(a)*.11
                    rig.pose.bones['coat.'+side].rotation_euler.x=-.11+math.sin(a+.4)*.055
                    rig.pose.bones['coat_tip.'+side].rotation_euler.x=-.10+math.sin(a+1)*.12
                else:
                    rig.pose.bones['coat.'+side].rotation_euler.x=math.sin(a+.4)*.015
                    rig.pose.bones['coat_tip.'+side].rotation_euler.x=math.sin(a+1)*.028
            rig.pose.bones['hair'].rotation_euler.x=math.sin(phase+.5)*.012
            rig.pose.bones['hair_tip'].rotation_euler.x=math.sin(phase+1)*(.04 if name=='Run' else .02)
            for p in rig.pose.bones:
                p.keyframe_insert('rotation_euler',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name)
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_start=1;scene.frame_end=121;scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for ob in meshes:ob.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'river-{key}-v1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False,export_yup=True)
    bpy.ops.object.camera_add(location=(1.8,-5,2.25));cam=bpy.context.object;target=Vector((0,0,1.1));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.65;scene.camera=cam
    for loc,power,size in [((2,-3,4),350,4),((-2,-1,3),170,3),((0,3,3),250,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color=(.16,.18,.20);scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.view_settings.view_transform='AgX';scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.render.filepath=str(ROOT/f'outputs/river-{key}-model-back.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'design/river-{key}-v1.blend'))
    bpy.ops.render.render(write_still=True)
    print('PAIR_CHARACTER_READY',json.dumps({'identity':key,'parts':len(meshes),'bones':len(rig.data.bones),'vertices':sum(len(m.data.vertices) for m in meshes),'animations':['Idle','Run']}))

if __name__ == '__main__':
    for key,config in PROFILES.items():build(key,config)
