"""Assemble CC0 Quaternius game meshes; retarget authored UAL clips in rest space.

Blender 5.2: blender -b -t 6 --python tools/blender/build_pair_characters_v3.py
Sources, licenses and acquisition hashes: design/vendor/quaternius/README.md.
No generated gait, auto weights, cloth shells or silhouette cards are used.
"""
import bpy, bmesh, math, json, sys, shutil, struct, hashlib
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2]
V=ROOT/'outputs/vendor/quaternius'
OUT=ROOT/'outputs/river-v3';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0

# Compact authored gait, adjusted with two-bone IK to keep the knee bend plane.
COMPACT_GAIT={'stride':.46,'footLift':.32,'pelvisRange':.018,'torsoLean':.55,'torsoMotion':.70,'armMotion':.35}
COMPACT_CYCLE_SECONDS=.90
TORSO_BONES=['pelvis','spine_01','spine_02','spine_03','neck_01','Head']
ARM_BONES=['clavicle_l','clavicle_r','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r']

def cyclic_height(samples, center, extent):
    """Keep the authored weight-transfer phase, without contact-switch spikes.

    Only the low harmonics of the original pelvis curve drive body height.
    They are continuous across the loop; foot contact never moves the body.
    """
    count=len(samples);mean=sum(samples)/count
    curve=[0.0]*count
    for harmonic in range(1,4):
        angles=[math.tau*harmonic*i/count for i in range(count)]
        a=2/count*sum((v-mean)*math.cos(t) for v,t in zip(samples,angles))
        b=2/count*sum((v-mean)*math.sin(t) for v,t in zip(samples,angles))
        for i,t in enumerate(angles):curve[i]+=a*math.cos(t)+b*math.sin(t)
    scale=extent/max(max(curve)-min(curve),1e-6)
    return [center+v*scale for v in curve]

def compact_stride(bones, rest, poses, foot_floor, pelvis_height, idle_pose, torso_mean, foot_targets):
    """Shorten jog trajectories, solve stable knees, and limit sole pitch.

    Scaling local joint quaternions independently changes the knee bend plane.
    IK instead keeps the ankle near its original lateral path and retains bone
    lengths with a consistent anatomical knee plane throughout the smaller step.
    """
    result={};solutions={}
    for pb in bones:
        n=pb.name;parent=pb.parent
        # Follow the changed parent with the authored local transform. This
        # also moves thigh/calf twist bones used by the original skin weights.
        result[n]=(result[parent.name] @ poses[parent.name].inverted() @ poses[n]) if parent else poses[n].copy()
        if n in TORSO_BONES:
            idle_local=(idle_pose[parent.name].inverted() @ idle_pose[n]) if parent else idle_pose[n]
            jog_local=(poses[parent.name].inverted() @ poses[n]) if parent else poses[n]
            # Reduce average forward lean separately from the animated twist.
            # Blending every frame toward idle also erased shoulder/hip rhythm.
            mean=torso_mean[n]
            posture=idle_local.to_quaternion().slerp(mean,COMPACT_GAIT['torsoLean'])
            motion=mean.inverted() @ jog_local.to_quaternion()
            rotation=posture @ Quaternion().slerp(motion,COMPACT_GAIT['torsoMotion'])
            local=rotation.to_matrix().to_4x4();local.translation=jog_local.translation
            result[n]=(result[parent.name] @ local) if parent else local
        elif n in ARM_BONES:
            # Keep the authored bent-elbow running posture and arm/leg phase,
            # but reduce the cyclic swing around that pose rather than idle.
            jog_local=poses[parent.name].inverted() @ poses[n]
            mean=torso_mean[n]
            motion=mean.inverted() @ jog_local.to_quaternion()
            rotation=mean @ Quaternion().slerp(motion,COMPACT_GAIT['armMotion'])
            local=rotation.to_matrix().to_4x4();local.translation=jog_local.translation
            result[n]=result[parent.name] @ local
        if n=='pelvis':
            result[n].translation.z=pelvis_height
        if n in ['thigh_l','thigh_r']:
            side=n[-1];calf='calf_'+side;foot='foot_'+side
            hip=result[n].translation.copy();oldfoot=poses[foot].translation
            goal=foot_targets[foot][0].copy()
            goal.y=rest[foot].translation.y+(goal.y-rest[foot].translation.y)*COMPACT_GAIT['stride']
            goal.z=foot_floor[foot]+(goal.z-foot_floor[foot])*COMPACT_GAIT['footLift']
            # Floor correction belongs to this foot, not the entire body. A
            # min(leftFoot, rightFoot) body offset creates a vertical kick at
            # every support-foot change even when its overall amplitude is small.
            attitude_delta=foot_targets[foot][1] @ poses[foot].to_quaternion().inverted()
            toe_offset=(attitude_delta @ (poses['ball_'+side].translation-oldfoot)).z
            sole_floor=min(rest['ball_l'].translation.z,rest['ball_r'].translation.z)
            goal.z=max(goal.z,sole_floor-min(0,toe_offset))
            upper=(rest[calf].translation-rest[n].translation).length
            lower=(rest[foot].translation-rest[calf].translation).length
            direction=(goal-hip).normalized();distance=min((goal-hip).length,(upper+lower)*.998)
            goal=hip+direction*distance
            # A source knee almost on the hip/ankle line can flip its IK pole
            # by 180 degrees. Endpoint positions still pass, but quaternion
            # interpolation bends the foot sideways between those endpoints.
            pole=Vector((.04 if side=='l' else -.04,-1,0))
            pole-=direction*pole.dot(direction)
            pole.normalize()
            along=(upper*upper-lower*lower+distance*distance)/(2*distance)
            knee=hip+direction*along+pole*math.sqrt(max(0,upper*upper-along*along))
            solutions[side]=(hip,knee,goal)
            rotation=(rest[calf].translation-rest[n].translation).rotation_difference(knee-hip) @ rest[n].to_quaternion()
            result[n]=rotation.to_matrix().to_4x4();result[n].translation=hip
        elif n in ['calf_l','calf_r']:
            hip,knee,goal=solutions[n[-1]];foot='foot_'+n[-1]
            rotation=(rest[foot].translation-rest[n].translation).rotation_difference(goal-knee) @ rest[n].to_quaternion()
            result[n]=rotation.to_matrix().to_4x4();result[n].translation=knee
        elif n in ['foot_l','foot_r']:
            result[n]=foot_targets[n][1].to_matrix().to_4x4()
            result[n].translation=solutions[n[-1]][2]
    return result

def load(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path),bone_heuristic='BLENDER')
    obs=[o for o in bpy.data.objects if o not in before and o.name in bpy.context.scene.objects]
    rig=next(o for o in obs if o.type=='ARMATURE')
    meshes=[o for o in obs if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
    return rig,meshes

def bind(mesh,rig):
    mesh.parent=rig;mesh.matrix_parent_inverse=Matrix.Identity(4)
    for mod in mesh.modifiers:
        if mod.type=='ARMATURE':mod.object=rig

def tint(mat,rgba):
    # glTF exports this multiply as baseColorFactor and keeps the authored maps.
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=rgba
    link=next((l for l in mat.node_tree.links if l.to_socket==bs.inputs['Base Color']),None)
    if link:
        tex=link.from_socket;mat.node_tree.links.remove(link)
        mul=mat.node_tree.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[2].default_value=rgba
        mat.node_tree.links.new(tex,mul.inputs[1]);mat.node_tree.links.new(mul.outputs[0],bs.inputs['Base Color'])
    mat.diffuse_color=rgba

def retarget(source,target):
    scene=bpy.context.scene
    for tr in list(source.animation_data.nla_tracks):source.animation_data.nla_tracks.remove(tr)
    target.animation_data_create();target.animation_data.action=None
    bones=list(target.pose.bones)
    # Armature is hierarchical (parent first), independent of glTF node ordering.
    bones.sort(key=lambda b:len(b.parent_recursive))
    sr={b.name:b.matrix_local.copy() for b in source.data.bones}
    tr={b.name:b.matrix_local.copy() for b in target.data.bones}
    ratio=tr['pelvis'].translation.z/sr['pelvis'].translation.z
    footnames=['foot_l','foot_r','ball_l','ball_r']
    srmin=min(sr[n].translation.z for n in footnames);trmin=min(tr[n].translation.z for n in footnames)
    actions=[]
    idle_height=None;idle_pose=None
    for srcname,name in [('Idle_Loop','Idle'),('Jog_Fwd_Loop','Run'),('Walk_Loop','Walk')]:
        source.animation_data.action=bpy.data.actions[srcname]
        start,end=source.animation_data.action.frame_range
        count=round(COMPACT_CYCLE_SECONDS*scene.render.fps) if name=='Run' else round(end-start)
        samples=[]
        # Sample before adding target actions, so evaluation cannot feed back.
        for f in range(count+1):
            time=start+(end-start)*f/count;scene.frame_set(math.floor(time),subframe=time%1)
            poses={b.name:b.matrix.copy() for b in source.pose.bones}
            samples.append(poses)
        retargeted=[]
        for sp in samples:
            posed={}
            for pb in bones:
                n=pb.name;rest=tr[n]
                if n=='root':desired=rest.copy()
                else:
                    rot=sp[n].to_quaternion() @ sr[n].to_quaternion().inverted() @ rest.to_quaternion()
                    if n=='pelvis':pos=rest.translation+(sp[n].translation-sr[n].translation)*ratio
                    else:pos=posed[pb.parent.name] @ tr[pb.parent.name].inverted() @ rest.translation
                    desired=rot.to_matrix().to_4x4();desired.translation=pos
                posed[n]=desired
            # Preserve the source's grounded/airborne phase with the target leg lengths.
            correction=(min(sp[n].translation.z for n in footnames)-srmin)*ratio+trmin-min(posed[n].translation.z for n in footnames)
            for n in posed:
                if n!='root':posed[n].translation.z+=correction
            retargeted.append(posed)
        if name=='Idle':
            idle_height=sum(p['pelvis'].translation.z for p in retargeted[:-1])/count
            idle_pose=retargeted[0]
        if name=='Run':
            floor={n:min(p[n].translation.z for p in retargeted) for n in ['foot_l','foot_r']}
            # A slightly relaxed knee and small continuous weight transfer,
            # instead of locking the hips at the standing leg extension.
            pelvis_heights=cyclic_height([p['pelvis'].translation.z for p in samples[:-1]],idle_height-.015,COMPACT_GAIT['pelvisRange'])
            pelvis_heights.append(pelvis_heights[0])
            torso_mean={}
            for pb in bones:
                n=pb.name
                if n not in TORSO_BONES+ARM_BONES:continue
                for i,p in enumerate(retargeted[:-1]):
                    local=p[pb.parent.name].inverted() @ p[n] if pb.parent else p[n]
                    q=local.to_quaternion()
                    torso_mean[n]=q if i==0 else torso_mean[n].slerp(q,1/(i+1))
            # Filter only end-effector targets around the loop. IK then rebuilds
            # the leg as one chain instead of averaging unrelated bone matrices.
            targets=[];kernel=[1,4,6,4,1]
            for f in range(count):
                frame_targets={}
                for n in ['foot_l','foot_r']:
                    position=Vector();rotation=None;total=0
                    for offset,weight in zip(range(-2,3),kernel):
                        matrix=retargeted[(f+offset)%count][n]
                        position+=matrix.translation*weight
                        q=matrix.to_quaternion()
                        rotation=q if rotation is None else rotation.slerp(q,weight/(total+weight))
                        total+=weight
                    rotation=tr[n].to_quaternion().slerp(rotation,.70)
                    frame_targets[n]=(position/total,rotation)
                targets.append(frame_targets)
            targets.append(targets[0])
            retargeted=[compact_stride(bones,tr,p,floor,pelvis_heights[f],idle_pose,torso_mean,targets[f]) for f,p in enumerate(retargeted)]
        action=bpy.data.actions.new(name);action.use_fake_user=True;target.animation_data.action=action
        previous={};baked=[]
        for f,posed in enumerate(retargeted):
            for pb in bones:
                n=pb.name;parent=pb.parent
                basis=pb.bone.convert_local_to_pose(posed[n],tr[n],parent_matrix=posed[parent.name] if parent else Matrix.Identity(4),parent_matrix_local=tr[parent.name] if parent else Matrix.Identity(4),invert=True)
                loc,rot,scale=basis.decompose()
                if n in previous and previous[n].dot(rot)<0:rot.negate()
                previous[n]=rot.copy();pb.rotation_mode='QUATERNION';pb.rotation_quaternion=rot;pb.location=loc;pb.scale=(1,1,1)
                pb.keyframe_insert('rotation_quaternion',frame=f,group=n)
                pb.keyframe_insert('location',frame=f,group=n)
            baked.append({p.name:(p.location.copy(),p.rotation_quaternion.copy()) for p in bones})
            if f==0:first=baked[0]
        # Close the supplied loop exactly, preserving the authored cycle duration.
        for p in bones:
            p.location,p.rotation_quaternion=first[p.name]
            p.keyframe_insert('location',frame=count,group=p.name);p.keyframe_insert('rotation_quaternion',frame=count,group=p.name)
        if name=='Run':
            # Matching endpoint poses alone is C0, and still visibly hesitates.
            # Match the entering/leaving local angular and linear velocities too.
            for p in bones:
                pos,q=first[p.name];p1,q1=baked[1][p.name];pn,qn=baked[-2][p.name]
                if q.dot(q1)<0:q1.negate()
                if q.dot(qn)<0:qn.negate()
                tangent=((q.inverted()@q1).to_exponential_map()-(q.inverted()@qn).to_exponential_map())*.5
                velocity=(p1-pn)*.5
                for frame,sign in [(1,1),(count-1,-1)]:
                    p.location=pos+velocity*sign;p.rotation_quaternion=q@Quaternion(tangent*sign)
                    p.keyframe_insert('location',frame=frame,group=p.name);p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name)
        actions.append(action)
        print('RETARGET',name,'duration',count/scene.render.fps,'frames',count,flush=True)
    return actions

def build(key):
    female=key=='bv';sex='Female' if female else 'Male'
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=60
    rig,meshes=load(next(V.glob(f'mirror/**/{sex}_Ranger.gltf')));rig.name=f'{key}_Quaternius_Humanoid'
    for o in list(meshes):
        if 'Hood' in o.name:bpy.data.objects.remove(o,do_unlink=True);meshes.remove(o)
    base=next(V.glob(f'base/**/Superhero_{sex}_FullBody.gltf'))
    # Vendor export has two typoed normal-map URIs. Resolve to bundled originals.
    for p in base.parent.glob('*_Normal.png'):
        alias=p.with_name(p.stem+'_png.png')
        if not alias.exists():shutil.copyfile(p,alias)
    hr,heads=load(base)
    for o in heads:
        if 'SuperHero' in o.name or 'Superhero' in o.name:
            bm=bmesh.new();bm.from_mesh(o.data)
            # Keep the original head and neck, buried inside the outfit collar.
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,1.49),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
            bm.to_mesh(o.data);bm.free();o.name=f'{key} authored head and neck'
        bind(o,rig);meshes.append(o)
    bpy.data.objects.remove(hr,do_unlink=True)
    hairname='Hair_Long' if female else 'Hair_SimpleParted'
    hairpath=next(p for p in V.glob(f'base/**/{hairname}.gltf') if 'Rigged to Head Bone' in str(p))
    hairrig,hairs=load(hairpath)
    for o in hairs:
        if female:
            # Extend the authored hair locks down the back, retaining their UVs.
            for v in o.data.vertices:
                t=max(0,min(1,(1.69-v.co.z)/.17));v.co.z-=.23*t*t;v.co.y+=.045*t
                if t>0:
                    for g in o.vertex_groups:g.remove([v.index])
                    for name,w in [('Head',1-t*.65),('spine_03',t*.65)]:
                        group=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);group.add([v.index],w,'REPLACE')
        bind(o,rig);meshes.append(o)
    bpy.data.objects.remove(hairrig,do_unlink=True)
    for o in meshes:
        for polygon in o.data.polygons:polygon.use_smooth=True
    # Use restrained dark leather, metal and cloth while retaining every texture.
    done=set()
    for o in meshes:
        for mat in o.data.materials:
            if not mat or mat in done:continue
            done.add(mat)
            if 'Hair' in mat.name:tint(mat,(.006,.007,.012,1) if female else (.48,.022,.028,1))
            elif 'Ranger' in mat.name:tint(mat,(.12,.13,.21,1) if female else (.40,.065,.085,1))
    src,srcmeshes=load(V/'UAL1-modern.glb');actions=retarget(src,rig)
    for o in srcmeshes:bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.objects.remove(src,do_unlink=True)
    for a in list(bpy.data.actions):
        if a not in actions:bpy.data.actions.remove(a)
    rig.animation_data.action=actions[0];scene.frame_start=0;scene.frame_end=round(actions[0].frame_range[1]);scene.frame_set(0)
    # Mobile/browser budget: the avatar occupies ~350 px, so 1K PBR maps
    # retain visible detail without downloading the vendor's 4K source atlases.
    images={}
    for o in meshes:
        for mat in o.data.materials:
            if mat and mat.use_nodes:
                for n in mat.node_tree.nodes:
                    if n.type!='TEX_IMAGE' or not n.image:continue
                    im=n.image;_pixel=im.pixels[0];path=Path(bpy.path.abspath(im.filepath))
                    digest=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else im.name
                    if digest in images:n.image=images[digest];continue
                    images[digest]=im
                    size=max(im.size)
                    if size>1024:im.scale(round(im.size[0]*1024/size),round(im.size[1]*1024/size))
                    # Resizing alone is not marked dirty by Blender (T95616).
                    # Save the resized pixels before packing, otherwise glTF
                    # silently embeds the full original 4K PNG again.
                    im.filepath_raw=str(OUT/f'{key}-{im.name}.png');im.file_format='PNG';im.save()
                    im.pack()
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/river-{key}-v3.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False)
    # Blender's generic MixRGB export omits the multiply on some versions.
    # Encode the same PBR factor explicitly, keeping all original texture bytes.
    glb=ROOT/f'public/models/river-{key}-v3.glb';data=glb.read_bytes();jl=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+jl]);binary=data[20+jl:]
    for mat in doc['materials']:
        if 'Hair' in mat['name']:factor=(.006,.007,.012,1) if female else (.48,.022,.028,1)
        elif 'Ranger' in mat['name']:factor=(.12,.13,.21,1) if female else (.40,.065,.085,1)
        else:continue
        mat['pbrMetallicRoughness']['baseColorFactor']=factor
    doc['asset']['extras']={'author':'Quaternius','license':'CC0-1.0','animationSource':'Universal Animation Library','retarget':'rest-space rotations with independent foot IK','locomotion':'compact Jog_Fwd_Loop, 0.90 second cycle, continuous weight transfer and shoulder-hip rhythm','compactGait':COMPACT_GAIT}
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+binary)
    # Studio views show geometry and native-material response, not concept art.
    target=Vector((0,0,.95));bpy.ops.object.camera_add(location=(2.7,-4.5,2.1));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.35;scene.camera=camera
    for loc,power,size in [((2,-4,4),220,4),((-3,-1,3),130,3),((1,3,4),280,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.10,.14,1)
    scene.render.engine='CYCLES';scene.cycles.samples=16;scene.view_settings.view_transform='AgX';scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    for view,loc,action,frame in [('front',(2.0,-4.5,1.9),actions[0],0),('back',(-2,4.5,1.9),actions[0],0),('stride',(3,-4,1.9),actions[1],18)]:
        rig.animation_data.action=action;scene.frame_set(frame);camera.location=loc;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/f'{key}-{view}.png');bpy.ops.render.render(write_still=True)
    rig.animation_data.action=actions[0];scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'design/river-{key}-v3.blend'))
    print('V3_READY',key,'verts',sum(len(o.data.vertices) for o in meshes),flush=True)
if __name__=='__main__':
    for key in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['alexx','bv']):build(key)
