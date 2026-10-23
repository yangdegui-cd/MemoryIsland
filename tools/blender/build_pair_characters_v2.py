"""Volumetric River characters using Blender Studio's CC0 human basemesh.

Anatomy comes from the official artist-authored closed mesh. Clothing is fitted
to that topology; hair, hood, hems, buckles and soles are modeled geometry.
Reference images supply fabric color only, never the body silhouette or alpha.
"""
import bpy, bmesh, math, random, json, sys
from pathlib import Path
from mathutils import Vector, Matrix, kdtree

ROOT=Path(__file__).resolve().parents[2]
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent))
from build_pair_characters import PROFILES
SOURCE=ROOT/'design/river-characters-v1'
VENDOR=ROOT/'design/vendor/blender-human-base-source.blend'
BUNDLE=ROOT/'outputs/vendor/blender-human/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend'
bpy.context.preferences.filepaths.save_version=0

def prepare_source():
    if VENDOR.exists():return
    names=['GEO-body_'+sex+'_realistic'+suffix for sex in ['male','female'] for suffix in ['', '.eye.L','.eye.R']]
    with bpy.data.libraries.load(str(BUNDLE)) as (_,data):data.objects=names;data.texts=['README']
    VENDOR.parent.mkdir(parents=True,exist_ok=True)
    bpy.data.libraries.write(str(VENDOR),set(data.objects+data.texts),fake_user=True,compress=True)

def smoothstep(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

def distance(point,a,b):
    delta=b-a;t=max(0,min(1,(point-a).dot(delta)/max(1e-8,delta.length_squared)))
    return (point-(a+delta*t)).length

def build(key):
    rng=random.Random(34 if key=='alexx' else 98);female=key=='bv';c=PROFILES[key]
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for collection in [bpy.data.actions,bpy.data.materials]:
        for item in list(collection):collection.remove(item)
    sex='female' if female else 'male';prefix=f'GEO-body_{sex}_realistic'
    with bpy.data.libraries.load(str(VENDOR)) as (_,data):data.objects=[prefix,prefix+'.eye.L',prefix+'.eye.R']
    body=data.objects[0];eyes=data.objects[1:];original_origin=body.location.copy()
    for ob in data.objects:bpy.context.collection.objects.link(ob);ob.hide_set(False);ob.hide_viewport=False;ob.hide_render=False
    body.name=f'{key} CC0 anatomical body'
    minimum=min(v.co.z for v in body.data.vertices);maximum=max(v.co.z for v in body.data.vertices)
    height=2.14 if female else 2.24;scale=height/(maximum-minimum)
    def transform(p):return Vector((-p.x*scale,-p.y*scale,(p.z-minimum)*scale))
    bpy.context.view_layer.update()
    for eye in eyes:
        world=eye.matrix_world.copy()
        for v in eye.data.vertices:v.co=transform(world@v.co-original_origin)
        eye.parent=None;eye.matrix_parent_inverse=Matrix.Identity(4);eye.matrix_world=Matrix.Identity(4)
    bpy.context.view_layer.objects.active=body
    # Evaluate the source sculpt before transforming it. Multires displacement
    # vectors are in the original object's space and cannot follow edited verts.
    for mod in list(body.modifiers):
        if mod.type=='MULTIRES':mod.levels=1;mod.sculpt_levels=1;mod.render_levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
        else:body.modifiers.remove(mod)
    for v in body.data.vertices:v.co=transform(v.co)
    body.location=(0,0,0);body.data.update()
    for p in body.data.polygons:p.use_smooth=True

    def mat(name,color,metal=0,rough=.5):
        m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
        return m
    skin=mat('Warm skin - solid anatomy',(.56,.32,.23) if female else (.49,.28,.19),0,.47)
    skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.07
    leather=mat('Black tailored leather',(.012,.016,.022),.08,.35)
    fabric=mat('Charcoal woven fabric',(.019,.022,.029),0,.72)
    lining=mat('Burgundy satin lining',(.075,.006,.015),.05,.44)
    silver=mat('Brushed silver hardware',(.40,.44,.50),.85,.26)
    seam=mat('Crimson piping' if not female else 'Garnet piping',(.22,.005,.013) if not female else (.065,.009,.022),.25,.36)
    if not female:
        bs=seam.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.65,.006,.009,1);bs.inputs['Emission Strength'].default_value=.20
    hairmats=[mat('Hair sculpt '+str(i),color,0,.34+i*.035) for i,color in enumerate([(.11,.008,.014),(.19,.012,.017),(.065,.003,.007)] if not female else [(.012,.009,.018),(.021,.015,.030),(.007,.006,.011)])]
    atlas=bpy.data.images.load(str(SOURCE/f'{key}-turnaround.png'),check_existing=True);atlas.pack()
    textured=mat(f'{key} fabric reference color',(.025,.025,.027),.06,.48)
    node=textured.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas
    textured.node_tree.links.new(node.outputs['Color'],textured.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    # Opaque PBR surface: no alpha cutout, no full-texture emission.
    body.data.materials.clear();body.data.materials.append(skin)
    for eye in eyes:
        eye.data.materials.clear();eye.data.materials.append(mat('Eye ivory',(.57,.53,.45),0,.22))

    # Use the basemesh's own cross sections to place anatomical joints.
    def center(z,lo,hi,sign):
        points=[v.co for v in body.data.vertices if abs(v.co.z-z)<.018 and lo<sign*v.co.x<hi]
        return Vector((sign*(lo+hi)*.5,0,z)) if not points else Vector((sum(p.x for p in points)/len(points),sum(p.y for p in points)/len(points),z))
    H=height/2.24
    arm=bpy.data.armatures.new(f'{key} anatomical skeleton');rig=bpy.data.objects.new(f'{key} volumetric rig',arm);bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    segments={}
    def bone(name,a,b,parent=None):
        a=Vector(a);b=Vector(b);ob=arm.edit_bones.new(name);ob.head=a;ob.tail=b
        if parent:ob.parent=arm.edit_bones[parent]
        segments[name]=(a,b)
    bone('root',(0,0,0),(0,0,.15))
    bone('pelvis',(0,0,1.10*H),(0,0,1.31*H),'root')
    bone('spine',(0,0,1.31*H),(0,0,1.62*H),'pelvis')
    bone('chest',(0,0,1.62*H),(0,0,1.90*H),'spine')
    bone('neck',(0,0,1.90*H),(0,0,2.00*H),'chest')
    bone('head',(0,0,2.00*H),(0,0,2.22*H),'neck')
    bone('hair',(0,-.14,2.06*H),(0,-.17,1.75*H),'head')
    bone('hair_tip',(0,-.17,1.75*H),(0,-.21,1.34*H),'hair')
    joints={}
    for side,sign in [('l',-1),('r',1)]:
        shoulder=center(1.83*H,.18,.34,sign);elbow=center(1.48*H,.27,.52,sign);wrist=center(1.15*H,.35,.65,sign)
        hip=center(1.10*H,.04,.25,sign);knee=center(.64*H,.02,.29,sign);ankle=center(.14*H,.02,.29,sign)
        bone('upper_arm.'+side,shoulder,elbow,'chest');bone('forearm.'+side,elbow,wrist,'upper_arm.'+side)
        bone('hand.'+side,wrist,wrist+Vector((sign*.04,.015,-.17*H)),'forearm.'+side)
        bone('thigh.'+side,hip,knee,'pelvis');bone('shin.'+side,knee,ankle,'thigh.'+side)
        bone('foot.'+side,ankle,(ankle.x,.19,.05),'shin.'+side)
        bone('coat.'+side,(sign*.14,-.12,1.24*H),(sign*.22,-.18,.87*H),'pelvis')
        bone('coat_tip.'+side,(sign*.22,-.18,.87*H),(sign*.32,-.25,.35*H),'coat.'+side)
        joints[side]={'shoulder':shoulder,'elbow':elbow,'wrist':wrist,'hip':hip,'knee':knee,'ankle':ankle}
    bpy.ops.object.mode_set(mode='OBJECT')
    meshes=[body]
    for eye in eyes:
        eye.parent=rig;g=eye.vertex_groups.new(name='head');g.add(list(range(len(eye.data.vertices))),1,'REPLACE');mod=eye.modifiers.new('Head skin','ARMATURE');mod.object=rig;meshes.append(eye)
    def bind(ob,weights):
        groups={}
        for v in ob.data.vertices:
            value=weights(v.co) if callable(weights) else {weights:1}
            for name,amount in value.items():
                if amount<=0:continue
                if name not in groups:groups[name]=ob.vertex_groups.new(name=name)
                groups[name].add([v.index],amount,'REPLACE')
        ob.parent=rig;mod=ob.modifiers.new('Anatomical skin','ARMATURE');mod.object=rig
    def secondary(co,part):
        if part=='hair':
            t=smoothstep(1.50*H,1.95*H,co.z);return {'head':t,'hair':(1-t)*.55,'hair_tip':(1-t)*.45}
        side='l' if co.x<0 else 'r';t=smoothstep(.60*H,1.27*H,co.z)
        return {'pelvis':max(0,(t-.75)*4),'coat.'+side:min(t,1-t)*1.5,'coat_tip.'+side:1-t} if t<.75 else {'pelvis':(t-.75)*4,'coat.'+side:1-(t-.75)*4}
    def normalize(weights):
        total=sum(weights.values());return {k:v/total for k,v in weights.items()}
    def arm_boundary(z):
        rows=[(.86,.43),(1.15,.43),(1.35,.36),(1.65,.29),(1.78,.24),(1.93,.21)]
        for (a,x),(b,y) in zip(rows,rows[1:]):
            if a<=z<=b:return (x+(y-x)*(z-a)/(b-a))*H
        return .43*H
    def is_arm(p):
        return abs(p.x)>arm_boundary(p.z/H) and .86*H<p.z<1.93*H
    def anatomy_weights(p):
        z=p.z/H;side='l' if p.x<0 else 'r';x=abs(p.x)
        if z>1.93:
            t=smoothstep(1.93,2.01,z);return {'neck':1-t,'head':t}
        shoulder_blend=smoothstep(arm_boundary(z)-.045*H,arm_boundary(z)+.045*H,x) if 1.65<z<1.93 else float(is_arm(p))
        if shoulder_blend>0:
            joint=joints[side]
            if p.z<joint['wrist'].z+.025:return {'hand.'+side:1}
            names=['upper_arm.'+side,'forearm.'+side]
            ds=[distance(p,*segments[n]) for n in names]
            values=normalize({n:math.exp(-(d/max(.001,min(ds+[.065])))**2) for n,d in zip(names,ds)})
            return {**{n:w*shoulder_blend for n,w in values.items()},'chest':1-shoulder_blend}
        if z<1.11:
            if z<.18:
                t=smoothstep(.10,.22,z);return {'foot.'+side:1-t,'shin.'+side:t}
            if z<.78:
                t=smoothstep(.53,.75,z);return {'shin.'+side:1-t,'thigh.'+side:t}
            t=smoothstep(.97,1.12,z);return {'thigh.'+side:1-t,'pelvis':t}
        if z<1.43:
            t=smoothstep(1.22,1.43,z);return {'pelvis':1-t,'spine':t}
        if z<1.75:
            t=smoothstep(1.47,1.73,z);return {'spine':1-t,'chest':t}
        t=smoothstep(1.86,1.96,z);return {'chest':1-t,'neck':t}
    # Solve anatomical weights on the intact closed human mesh. Hair/coat bones
    # are outside the body and must not participate in the heat solution.
    body.vertex_groups.clear()
    for b in arm.bones:b.use_deform=b.name!='root' and not b.name.startswith(('hair','coat'))
    cage=body
    if female:
        cage=body.copy();cage.data=body.data.copy();cage.name='Temporary watertight binding cage';bpy.context.collection.objects.link(cage)
        bpy.ops.object.select_all(action='DESELECT');cage.select_set(True);bpy.context.view_layer.objects.active=cage
        remesh=cage.modifiers.new('Closed anatomical heat cage','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.016
        bpy.ops.object.modifier_apply(modifier=remesh.name)
    bpy.ops.object.select_all(action='DESELECT');cage.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    if any(not v.groups or sum(g.weight for g in v.groups)<.001 for v in cage.data.vertices):
        raise RuntimeError(f'{key}: automatic anatomical skinning left unweighted vertices')
    if female:
        tree=kdtree.KDTree(len(cage.data.vertices))
        for v in cage.data.vertices:tree.insert(v.co,v.index)
        tree.balance()
        def cage_weights(co):
            values={}
            for _,index,d in tree.find_n(co,4):
                for g in cage.data.vertices[index].groups:
                    name=cage.vertex_groups[g.group].name;values[name]=values.get(name,0)+g.weight/max(.000001,d*d)
            return normalize(dict(sorted(values.items(),key=lambda item:-item[1])[:4]))
        bind(body,cage_weights);bpy.data.objects.remove(cage,do_unlink=True)
    for b in arm.bones:b.use_deform=True
    def create(name,verts,faces,material,weights,uvs=None):
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(material)
        for p in me.polygons:p.use_smooth=True
        if uvs:
            layer=me.uv_layers.new(name='Fabric coordinates')
            for p in me.polygons:
                for li in p.loop_indices:layer.data[li].uv=uvs[me.loops[li].vertex_index]
        bind(ob,weights);meshes.append(ob);return ob
    def finish_primitive(ob,name,material,weights,bevel=0):
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        if bevel:
            mod=ob.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.name=name;ob.data.materials.clear();ob.data.materials.append(material)
        for p in ob.data.polygons:p.use_smooth=True
        bind(ob,weights);meshes.append(ob);return ob
    def ellipsoid(name,location,size,material,weights):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=location);ob=bpy.context.object;ob.scale=size
        return finish_primitive(ob,name,material,weights)
    def strip(name,points,width,thickness,material,weights):
        # Closed, tapered sculpted strand/trim, not a camera-facing card.
        vs=[];fs=[];count=8
        for i,p in enumerate(points):
            p=Vector(p);t=i/max(1,len(points)-1);tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            tangent.normalize();axis=tangent.cross(Vector((0,1,0)))
            if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
            axis.normalize();other=tangent.cross(axis).normalized();taper=max(.035,math.sin(math.pi*(t*.92+.045))**.48)
            for j in range(count):
                a=j/count*math.tau;vs.append(tuple(p+axis*(math.cos(a)*width*taper)+other*(math.sin(a)*thickness*taper)))
        for i in range(len(points)-1):
            for j in range(count):a=i*count+j;b=i*count+(j+1)%count;fs.append((a,b,b+count,a+count))
        fs+=[tuple(range(count-1,-1,-1)),tuple((len(points)-1)*count+j for j in range(count))]
        return create(name,vs,fs,material,weights)
    def trim(name,points,radius,material,weights):return strip(name,points,radius,radius,material,weights)

    body_tree=kdtree.KDTree(len(body.data.vertices))
    for v in body.data.vertices:body_tree.insert(v.co,v.index)
    body_tree.balance()
    def region(co):
        z=co.z/H;x=abs(co.x)
        if z>1.94:return 'head'
        nearest=body.data.vertices[body_tree.find(co)[1]]
        arm_weight=sum(g.weight for g in nearest.groups if any(n in body.vertex_groups[g.group].name for n in ['arm','hand']))
        if arm_weight>.45:
            return 'arm' if z>1.22 else 'hand'
        if z<1.11:return 'leg'
        return 'torso'
    def uv(co):
        py=c['floor']-co.z/height*(c['floor']-c['head'][0]);px=co.x/(height/(c['floor']-c['head'][0]))
        return ((c['center']+px if co.y<0 else c['front']-px)/1536,1-py/1024)
    def fitted(name,predicate,material,offset,roughfold=0):
        ob=body.copy();ob.data=body.data.copy();ob.name=name;bpy.context.collection.objects.link(ob)
        bm=bmesh.new();bm.from_mesh(ob.data)
        bmesh.ops.delete(bm,geom=[p for p in bm.faces if not predicate(p.calc_center_median())],context='FACES')
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        boundary=[v for v in bm.verts if v.is_boundary]
        for _ in range(3):bmesh.ops.smooth_vert(bm,verts=boundary,factor=.5,use_axis_x=True,use_axis_y=True,use_axis_z=True)
        bm.to_mesh(ob.data);bm.free();ob.data.update()
        for v in ob.data.vertices:
            p=v.co.copy();fold=roughfold*(math.sin(p.z*69+p.x*14)*.6+math.sin(p.z*103-p.y*24)*.4)
            v.co+=v.normal*(offset+fold)
        ob.data.materials.clear();ob.data.materials.append(material)
        layer=ob.data.uv_layers.new(name='Reference color on fitted cloth')
        for p in ob.data.polygons:
            p.material_index=0;p.use_smooth=True
            for li in p.loop_indices:layer.data[li].uv=uv(ob.data.vertices[ob.data.loops[li].vertex_index].co)
        ob.data.uv_layers.active=layer;layer.active_render=True
        meshes.append(ob);return ob
    # All clothes wrap an actual closed anatomical volume; no transparency.
    top_edge=1.77 if female else 1.89
    fitted(key+' fitted top',lambda p:region(p)=='torso' and 1.24*H<p.z<top_edge*H,textured,.017,.0015)
    fitted(key+' fitted shorts' if female else key+' tailored trousers',lambda p:(region(p)=='leg' or region(p)=='torso') and .13*H<p.z<1.29*H and (not female or p.z>.99*H),textured,.013,.0022)
    if not female:fitted('Layered coat sleeves',lambda p:region(p) in ['arm','hand'] and p.z>1.16*H,fabric,.022,.0018)
    # Boot lasts bridge the toes into one manufactured shoe, rather than
    # inflating each anatomical toe through a skin-tight material.
    for side,sign in [('l',-1),('r',1)]:
        ankle=joints[side]['ankle'];vs=[];fs=[];rings=26;cols=48;top=(.91 if female else .43)*H
        for r in range(rings):
            z=.045+(top-.045)*r/(rings-1)
            if z<.17:
                t=(z-.045)/.125;rx=.080-.010*t;ry=.156-.085*smoothstep(.25,1,t);cy=.052-.065*smoothstep(.25,1,t);cx=ankle.x
            else:
                cc=center(z,.02,.29,sign);samples=[v.co for v in body.data.vertices if abs(v.co.z-z)<.012 and sign*v.co.x>0 and abs(v.co.x-cc.x)<.17]
                cx=cc.x;cy=cc.y
                rx=(max((abs(v.x-cx) for v in samples),default=.065))+.012
                ry=(max((abs(v.y-cy) for v in samples),default=.070))+.012
            for j in range(cols):
                a=j/cols*math.tau;vs.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
        for r in range(rings-1):
            for j in range(cols):a=r*cols+j;b=r*cols+(j+1)%cols;fs.append((a,b,b+cols,a+cols))
        fs.append(tuple(range(cols-1,-1,-1)))
        create('Sculpted leather boot '+side,vs,fs,leather,anatomy_weights)
    fitted('Fingerless gloves',lambda p:region(p)=='hand' and p.z>1.02*H,leather,.006)

    # Hair uses a sculpted scalp cap and overlapping closed 3D locks.
    scalp=fitted('Solid scalp hair',lambda p:p.z>(2.185 if p.y>.04 else 2.045)*H,hairmats[0],.009)
    center_head=Vector((0,.015,2.125*H))
    for i in range(125 if not female else 100):
        phi=i*2.39996;start=.18+(i%7)*.12;end=(1.1 if math.sin(phi)>0 else 1.65)+rng.uniform(-.1,.18)
        points=[]
        for j in range(13):
            t=j/12;a=start+(end-start)*t;turn=phi+.55*t
            p=Vector((.122*math.sin(a)*math.cos(turn),.13*math.sin(a)*math.sin(turn),.145*math.cos(a)))
            p+=center_head;p.z+=.018*math.sin(t*math.pi)
            if not female:p+=Vector((.025*math.cos(phi)*t**3,.015*math.sin(phi)*t**3,-.035*t**3))
            points.append(p)
        strip('Sculpted crown hair',points,rng.uniform(.010,.023),rng.uniform(.004,.009),hairmats[i%3],'head')
    for i in range(26):
        x=-.105+i/25*.21;points=[]
        for j in range(16):
            t=j/15;points.append((x+.045*math.sin(t*math.pi),.035+.12*math.sin(t*math.pi*.55),(2.265-.105*t)*H+.018*math.sin(i)))
        strip('Swept forehead fringe',points,.010,.0045,hairmats[i%3],'head')
    if female:
        for i in range(62):
            a=math.pi*.07+(i/61)*math.pi*.86;x=.15*math.cos(a);yy=-.06-.10*math.sin(a);length=rng.uniform(.53,.82)
            points=[]
            for j in range(25):
                t=j/24;s=smoothstep(0,.24,t);points.append(Vector((x*(.50+.5*s+.4*t)+.020*math.sin(t*math.pi*3+i)*t,yy*s-.075*t+.018*math.sin(t*math.pi*3+i*.7),2.24*H-(length+.16*H)*t)))
            strip('Long wavy hair bundle',points,rng.uniform(.012,.028),rng.uniform(.005,.010),hairmats[i%3],lambda p:normalize(secondary(p,'hair')))
            if i%3==0:
                for side in [-1,1]:trim('Fine raised hair strand',[p+Vector((side*.009,-.006,0)) for p in points],.0015,hairmats[1],lambda p:normalize(secondary(p,'hair')))

    # Draped coat / skirt wraps around the sides, with rounded folds and lining.
    for side,sign in [('l',-1),('r',1)]:
        vs=[];fs=[];uvs=[];rows=48;cols=28
        def coatpoint(t,u):
            a=sign*(.09+u*1.96)
            rx=.245+(.10 if female else .15)*t;ry=.145+.11*t
            fold=.018*math.sin(u*math.pi*7+.6*t)*math.sin(t*math.pi*.85)
            z=(1.26-t*(.73 if female else .92)+.14*u*u*t)*H
            return Vector(((rx+fold)*math.sin(a),-(ry+fold)*math.cos(a)-.035*t,z))
        for r in range(rows+1):
            for j in range(cols+1):p=coatpoint(r/rows,j/cols);vs.append(p);uvs.append(uv(p))
        for r in range(rows):
            for j in range(cols):
                a=r*(cols+1)+j;face=(a,a+1,a+cols+2,a+cols+1);fs.append(face if sign<0 else tuple(reversed(face)))
        coat=create('Volumetric draped '+('skirt ' if female else 'coat ')+side,vs,fs,textured if not female else leather,lambda p:normalize(secondary(p,'coat')),uvs)
        coat.data.materials.append(lining)
        # Thickness is baked into the exported geometry before skin deformation.
        solid=coat.modifiers.new('Visible rolled fabric thickness','SOLIDIFY');solid.thickness=.009;solid.offset=0;solid.material_offset=1
        bpy.context.view_layer.objects.active=coat;bpy.ops.object.modifier_move_up(modifier=solid.name);bpy.ops.object.modifier_apply(modifier=solid.name)
        for edge in [0,1]:trim('Raised coat piping',[coatpoint(j/28,edge)+Vector((0,-.005,0)) for j in range(29)],.0032,seam,lambda p:normalize(secondary(p,'coat')))
        trim('Rounded coat hem',[coatpoint(1,j/28) for j in range(29)],.004,leather,lambda p:normalize(secondary(p,'coat')))
        # Long strap and metal buckle, both have tangible depth.
        points=[coatpoint(t,.57)+Vector((0,-.014,0)) for t in [.08,.25,.42,.59,.76]]
        strip('Hanging leather strap',points,.013,.003,leather,lambda p:normalize(secondary(p,'coat')))
        at=coatpoint(.62,.57)+Vector((0,-.025,0));ring=[]
        for x,z in [(-.025,-.032),(.025,-.032),(.025,.032),(-.025,.032),(-.025,-.032)]:ring.append(at+Vector((x,0,z)))
        trim('Coat strap silver buckle',ring,.004,silver,'coat.'+side)
    if not female:
        # Sagging hood bowl and a thick folded rim, separate from neck and back.
        vs=[];fs=[];rows=22;cols=64
        for r in range(rows+1):
            t=r/rows;z=(1.67+t*.27)*H;rx=.075+.14*math.sin(t*math.pi*.65);ry=.025+.065*t
            for j in range(cols):
                a=j/cols*math.tau;vs.append((rx*math.cos(a),-.14-ry*math.sin(a)-.02*math.sin(t*math.pi),z+.025*math.cos(a)))
        for r in range(rows):
            for j in range(cols):a=r*cols+j;b=r*cols+(j+1)%cols;fs.append((a,b,b+cols,a+cols))
        create('Sculpted hanging hood',vs,fs,fabric,'chest')
        trim('Thick hood rolled edge',[vs[rows*cols+j%cols] for j in range(cols+1)],.015,leather,'chest')
        for sign in [-1,1]:
            trim('Raised coat back seam',[(sign*.11,-.17,1.85*H),(sign*.14,-.16,1.65*H),(sign*.09,-.125,1.43*H),(sign*.13,-.15,1.27*H)],.003,seam,'spine')
            strip('Layered leather lapel',[(sign*.085,.125,1.90*H),(sign*.17,.16,1.81*H),(sign*.10,.19,1.67*H)],.029,.007,leather,'chest')
        trim('Neck collar rim',[(.09*math.sin(j/48*math.tau),.075*math.cos(j/48*math.tau),1.91*H) for j in range(49)],.012,leather,'chest')
    else:
        for sign in [-1,1]:
            strip('Leather shoulder strap',[(sign*.15,.17,1.70*H),(sign*.17,.11,1.84*H),(sign*.17,0,1.90*H),(sign*.16,-.13,1.78*H)],.017,.004,leather,'chest')

    # Belts, eye detail, boot soles and jewelry are real mesh components.
    for z in [1.28*H,1.22*H] if female else [1.26*H]:
        pts=[(.245*math.sin(j/64*math.tau),-.155*math.cos(j/64*math.tau),z) for j in range(65)]
        trim('Waist leather belt',pts,.018,leather,'pelvis')
        trim('Waist buckle',[(x,.177,z+dz) for x,dz in [(-.035,-.026),(.035,-.026),(.035,.026),(-.035,.026),(-.035,-.026)]],.006,silver,'pelvis')
    for side,sign in [('l',-1),('r',1)]:
        ankle=joints[side]['ankle']
        bpy.ops.mesh.primitive_cube_add(size=1,location=(ankle.x,.07,.035));ob=bpy.context.object;ob.scale=(.145,.30,.05)
        finish_primitive(ob,'Beveled boot sole',leather,'foot.'+side,.025)
        for z in ([.25,.37,.82] if female else [.18,.31]):
            x=ankle.x;trim('Boot silver buckle',[(x+sign*.067,y,z*H+dz) for y,dz in [(-.02,-.016),(.025,-.016),(.025,.016),(-.02,.016),(-.02,-.016)]],.0035,silver,'shin.'+side)
    for eye in eyes:
        ec=sum((v.co for v in eye.data.vertices),Vector())/len(eye.data.vertices)
        iris=mat('Brown iris',(.07,.025,.008),.05,.26);pupil=mat('Pupil',(.001,.001,.001),0,.2)
        ellipsoid('Iris',(ec.x,ec.y+.017,ec.z),(.009,.003,.009),iris,'head')
        ellipsoid('Pupil',(ec.x,ec.y+.019,ec.z),(.004,.002,.005),pupil,'head')
    if female:
        for j in range(12):
            t=j/11;x=-.24+.13*t;y=.04+.13*math.sin(t*math.pi);z=(1.20-.13*math.sin(t*math.pi))*H
            bpy.ops.mesh.primitive_torus_add(major_segments=12,minor_segments=6,location=(x,y,z),major_radius=.010,minor_radius=.002,rotation=(math.pi/2,0,0))
            finish_primitive(bpy.context.object,'Linked hip chain',silver,'pelvis')
        trim('Silver hair pin',[(-.10,.095,2.13*H),(-.14,.10,2.10*H),(-.12,.115,2.06*H)],.004,silver,'head')

    # Remove hidden nude body polygons to guarantee clothing coverage in motion.
    bm=bmesh.new();bm.from_mesh(body.data)
    hidden=[]
    for face in bm.faces:
        p=face.calc_center_median();part=region(p)
        if (part=='torso' and p.z<top_edge*H) or (part=='leg' and (not female or p.z>.99*H or p.z<.91*H)) or (part in ['arm','hand'] and not female and p.z>1.16*H):hidden.append(face)
    bmesh.ops.delete(bm,geom=hidden,context='FACES');bm.to_mesh(body.data);bm.free()

    # Cyclic locomotion on the anatomical rig, with independent hair/coat motion.
    scene=bpy.context.scene;scene.render.fps=30;rig.animation_data_create()
    for name,last,step in [('Idle',121,10),('Run',25,2)]:
        act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
        for frame in sorted(set(list(range(1,last+1,step))+[last])):
            scene.frame_set(frame);phase=(frame-1)/(last-1)*math.tau
            for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
            rig.pose.bones['chest'].rotation_euler.x=.008*math.sin(phase);rig.pose.bones['head'].rotation_euler.z=.01*math.sin(phase)
            for i,side in enumerate(['l','r']):
                a=phase+i*math.pi;sign=1 if side=='l' else -1
                rig.pose.bones['upper_arm.'+side].rotation_euler.z=-sign*.09
                if name=='Run':
                    rig.pose.bones['pelvis'].location.z=.020+.019*math.cos(phase*2)
                    rig.pose.bones['spine'].rotation_euler.x=.045
                    rig.pose.bones['thigh.'+side].rotation_euler.x=math.sin(a)*.47
                    rig.pose.bones['shin.'+side].rotation_euler.x=-.15-max(0,-math.sin(a))*.65
                    rig.pose.bones['foot.'+side].rotation_euler.x=.1+math.sin(a)*.1
                    rig.pose.bones['upper_arm.'+side].rotation_euler.x=-math.sin(a)*.32
                    rig.pose.bones['forearm.'+side].rotation_euler.x=.35+math.sin(a)*.08
                    rig.pose.bones['coat.'+side].rotation_euler.x=-.08+math.sin(a+.3)*.06
                    rig.pose.bones['coat_tip.'+side].rotation_euler.x=-.08+math.sin(a+.8)*.10
                else:
                    rig.pose.bones['coat.'+side].rotation_euler.x=math.sin(a+.4)*.012
                    rig.pose.bones['coat_tip.'+side].rotation_euler.x=math.sin(a+1)*.022
            rig.pose.bones['hair'].rotation_euler.x=math.sin(phase+.4)*.015
            rig.pose.bones['hair_tip'].rotation_euler.x=math.sin(phase+1)*(.04 if name=='Run' else .018)
            for p in rig.pose.bones:p.keyframe_insert('rotation_euler',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name)
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_start=1;scene.frame_end=121;scene.frame_set(1)
    # Consolidate decorative parts by material; retain their skin weights.
    for material in list(bpy.data.materials):
        group=[o for o in meshes if len(o.data.materials)==1 and o.data.materials[0]==material and o!=body]
        if len(group)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();joined=group[0]
        meshes=[o for o in meshes if o not in group]+[joined]
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/river-{key}-v2.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False)
    bpy.ops.object.camera_add(location=(2.5,-4.5,2.15));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.75;scene.camera=camera
    target=Vector((0,0,1.13));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size in [((2,-4,4),300,4),((-3,-1,3),180,3),((1,3,4),300,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.size=size;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color=(.12,.14,.16);scene.render.engine='CYCLES';scene.cycles.samples=24;scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=750;scene.render.resolution_y=950;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'design/river-{key}-v2.blend'))
    for name,loc in [('back',(2.2,-4.5,2.15)),('side',(4.5,-.5,2.0)),('front',(1.8,4.5,2.1))]:
        camera.location=loc;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/f'outputs/river-{key}-v2-{name}.png');bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions['Run'];scene.frame_set(7)
    camera.location=(3.4,-3.7,2.0);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/f'outputs/river-{key}-v2-stride.png');bpy.ops.render.render(write_still=True)
    print('V2_CHARACTER_READY',key,'vertices',sum(len(o.data.vertices) for o in meshes),'parts',len(meshes),'joints',len(arm.bones),flush=True)

prepare_source()
for identity in ['alexx','bv']:build(identity)
