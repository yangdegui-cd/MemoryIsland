"""Render the actual v8 Blender geometry from its front and back for inspection."""
import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'design/river-architecture-v8.blend'))
for ob in bpy.context.scene.objects:
    ob.hide_render=ob.name not in ('Portal','PortalAperture')
for name in ['Portal','PortalAperture']:
    front=bpy.data.objects[name]
    back=front.copy();back.data=front.data
    bpy.context.collection.objects.link(back)
    front.location.x=-2.5
    back.rotation_euler.z=math.pi
    back.location=(2.5,1.56,0)
    back.hide_render=False
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.29,.34,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for position,power,size in [((-4,-6,10),1600,7),((6,-2,7),1300,5),((0,5,10),1800,6)]:
    bpy.ops.object.light_add(type='AREA',location=position)
    light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,.78,3))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(8,-19,8))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,.78,3.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=11.8;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'outputs/river-v8-front-back.png')
bpy.ops.render.render(write_still=True)
