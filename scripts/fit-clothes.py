# Fits the owner's Meshy starter clothes to the Adventurer, skins them from the body's weights,
# and exports each with the rig into client/public/models. Run from the repo root:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/fit-clothes.py -- \
#     client/public/models/Adventurer.glb client/public/models "<Game Assets>/personal" 45 5000
# Arguments: the Adventurer, the output folder, the folder of Meshy models, how far (degrees) the
# tunic's sleeves hang below the rig's T-pose arms, and the tunic's triangle budget.
import bpy, sys, os, math, bmesh
from mathutils import Vector, Matrix
A = sys.argv[sys.argv.index('--')+1:]
ADV, OUT, PERSONAL = (os.path.abspath(a) for a in A[:3])
ARM_DROP = math.radians(float(A[3]) if len(A) > 3 else 40)
FILES = {
  'leafTunic': 'Meshy_AI_Leaf_Tunic_20260917_texture_remesh_tri.glb',
  'brownPants': 'Meshy_AI_Low_Poly_Brown_Pants_20261027_texture.glb',
  'burlapBoots': 'Meshy_AI_Low_Poly_Burlap_Boot_20261125_texture.glb',
}
bpy.ops.wm.read_factory_settings(use_empty=True)

def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

new = imp(ADV)
for o in [o for o in new if o.name.startswith('Icosphere')]: bpy.data.objects.remove(o)
for act in bpy.data.actions: act.use_fake_user = True
rig = bpy.data.objects['rig']; body = bpy.data.objects['geometry_0']
rig.animation_data_clear() if rig.animation_data else None
for pb in rig.pose.bones: pb.matrix_basis = Matrix()
bpy.context.view_layer.update()

def posed_body(drop):
    """The body's mesh deformed into the pose, arms lowered by `drop`, as a new object."""
    for pb in rig.pose.bones: pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()
    for side, sign in (('L', 1), ('R', -1)):
        pb = rig.pose.bones[f'DEF-upper_arm.{side}']
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(sign*drop, 4, 'Y') @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg), depsgraph=dg)
    me.transform(body.matrix_world)
    o = bpy.data.objects.new('bodyPosed', me); bpy.context.collection.objects.link(o)
    for g in body.vertex_groups: o.vertex_groups.new(name=g.name)
    for v, src in zip(me.vertices, body.data.vertices):
        for ge in src.groups: o.vertex_groups[ge.group].add([v.index], ge.weight, 'REPLACE')
    return o

def load_piece(file):
    objs = imp(f'{PERSONAL}/{file}')
    meshes = [o for o in objs if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for x in objs:
        if x != o and x.name in bpy.data.objects: bpy.data.objects.remove(x)
    return o

def verts(o): return [o.matrix_world @ v.co for v in o.data.vertices]
def box(vs):
    return Vector([min(v[i] for v in vs) for i in range(3)]), Vector([max(v[i] for v in vs) for i in range(3)])
def band(vs, zlo, zhi, xmin=-9, xmax=9):
    b = [v for v in vs if zlo <= v.z <= zhi and xmin <= v.x <= xmax]
    return box(b)

def fit(o, src, dst, margin):
    """Maps box `src` of o onto box `dst`, per axis, grown by `margin` on x and y."""
    (s0, s1), (d0, d1) = src, dst
    sc = Vector([(d1[i]-d0[i])/(s1[i]-s0[i]) for i in range(3)])
    sc.x *= margin; sc.y *= margin
    sc_mid = (s0+s1)/2; d_mid = (d0+d1)/2
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        q = Vector([(p[i]-sc_mid[i])*sc[i] + d_mid[i] for i in range(3)])
        v.co = o.matrix_world.inverted() @ q

def decimate(o, tris):
    bm = bmesh.new(); bm.from_mesh(o.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    print('merged', o.name, before, '->', len(bm.verts))
    bm.to_mesh(o.data); bm.free()
    n = sum(len(p.vertices)-2 for p in o.data.polygons)
    if n > tris:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = tris/n
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)

def transfer_weights(o, src):
    m = o.modifiers.new('dt', 'DATA_TRANSFER'); m.object = src
    m.use_vert_data = True; m.data_types_verts = {'VGROUP_WEIGHTS'}
    m.vert_mapping = 'POLYINTERP_NEAREST'
    m.layers_vgroup_select_src = 'ALL'; m.layers_vgroup_select_dst = 'NAME'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.datalayout_transfer(modifier=m.name)
    bpy.ops.object.modifier_apply(modifier=m.name)

def unpose(o):
    """Moves o's vertices from the current pose back to the rest pose, inverting linear blend skinning."""
    mats = {pb.name: pb.matrix @ pb.bone.matrix_local.inverted() for pb in rig.pose.bones}
    names = {g.index: g.name for g in o.vertex_groups}
    for v in o.data.vertices:
        M = Matrix(((0,)*4,)*4); total = 0
        for ge in v.groups:
            if ge.weight > 0 and names[ge.group] in mats:
                M = M + mats[names[ge.group]] * ge.weight; total += ge.weight
        if total > 0: v.co = (M * (1/total)).inverted() @ v.co

def bind(o, name):
    o.name = o.data.name = name
    o.parent = rig
    m = o.modifiers.new('Armature', 'ARMATURE'); m.object = rig

def shrink_textures(o, size=512):
    for mat in o.data.materials:
        if not mat or not mat.use_nodes: continue
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        for inp in ('Metallic', 'Roughness', 'Normal'):
            for l in list(bsdf.inputs[inp].links): mat.node_tree.links.remove(l)
        bsdf.inputs['Metallic'].default_value = 0; bsdf.inputs['Roughness'].default_value = 0.9
        for n in mat.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and max(n.image.size) > size:
                n.image.scale(size, size)

from mathutils.bvhtree import BVHTree
def push_out(o, skin, gap):
    """Moves every vertex of o that is inside `skin`, or closer than `gap` above it, out to `gap` along the skin's normal."""
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(skin, dg)
    inv = o.matrix_world.inverted()
    moved = 0
    for _ in range(3):
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            hit, n, _, _ = tree.find_nearest(p)
            if hit is None: continue
            if (p - hit).dot(n) < gap:
                v.co = inv @ (hit + n * gap); moved += 1
    print('pushed', o.name, moved)

def baked_lowpoly(o, tris, voxel, size=512):
    """A clean copy of o at about `tris` triangles, with o's base colour baked onto a fresh unwrap."""
    low = o.copy(); low.data = o.data.copy(); bpy.context.collection.objects.link(low)
    low.data.materials.clear()
    bpy.context.view_layer.objects.active = low
    m = low.modifiers.new('r', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=m.name)
    n = len(low.data.polygons) * 2
    m = low.modifiers.new('d', 'DECIMATE'); m.ratio = min(1, tris / n)
    bpy.ops.object.modifier_apply(modifier=m.name)
    m = low.modifiers.new('t', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=m.name)
    for uv in list(low.data.uv_layers): low.data.uv_layers.remove(uv)
    low.data.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT'); low.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=0.02); bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{o.name}_baked', size, size)
    mat = bpy.data.materials.new(f'{o.name}_baked'); mat.use_nodes = True
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = img
    bsdf = mat.node_tree.nodes['Principled BSDF']
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.nodes.active = tex
    low.data.materials.append(mat)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 4
    sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = voxel * 2
    sc.render.bake.margin = 4
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    img.pack()
    print('baked', o.name, len(low.data.polygons))
    bpy.data.objects.remove(o)
    return low

GAP = 0.008
TUNIC_TRIS = int(sys.argv[-1])
B = lambda lo, hi: (Vector(lo), Vector(hi))
def piece_band(o, f0, f1):
    vs = verts(o); lo, hi = box(vs); h = hi.z - lo.z
    a, b = band(vs, lo.z + h*f0, lo.z + h*f1)
    return B((a.x, a.y, lo.z), (b.x, b.y, hi.z))

def dress(name, drop, src_of, dst, margin, tris, voxel=None):
    o = load_piece(FILES[name])
    o = baked_lowpoly(o, tris, voxel) if voxel else (decimate(o, tris) or o)
    fit(o, src_of(o), dst, margin)
    posed = posed_body(drop)
    push_out(o, posed, GAP)
    transfer_weights(o, posed)
    unpose(o)
    bpy.data.objects.remove(posed)
    for pb in rig.pose.bones: pb.matrix_basis = Matrix()
    shrink_textures(o); bind(o, name)
    return o

tunic = dress('leafTunic', ARM_DROP, lambda o: piece_band(o, 0.2, 0.4),
              B((-0.112, -0.101, 0.33), (0.112, 0.071, 0.665)), 1.12, TUNIC_TRIS)
pants = dress('brownPants', 0, lambda o: piece_band(o, 0.8, 0.95),
              B((-0.111, -0.101, 0.115), (0.111, 0.081, 0.455)), 1.12, 2500, voxel=0.025)

# One boot, turned to face forward, fitted to the left foot, then mirrored onto the right.
boot = load_piece(FILES['burlapBoots'])
boot.rotation_euler.z = math.pi/2
bpy.context.view_layer.objects.active = boot
bpy.ops.object.select_all(action='DESELECT'); boot.select_set(True)
bpy.ops.object.transform_apply(rotation=True)
fit(boot, box(verts(boot)), B((0.034, -0.125, -0.004), (0.15, 0.085, 0.16)), 1.1)
right = boot.copy(); right.data = boot.data.copy(); bpy.context.collection.objects.link(right)
for v in right.data.vertices: v.co.x = -v.co.x
right.data.flip_normals()
bpy.ops.object.select_all(action='DESELECT'); boot.select_set(True); right.select_set(True)
bpy.context.view_layer.objects.active = boot; bpy.ops.object.join()
posed = posed_body(0); push_out(boot, posed, GAP); transfer_weights(boot, posed); bpy.data.objects.remove(posed)
for pb in rig.pose.bones: pb.matrix_basis = Matrix()
shrink_textures(boot); bind(boot, 'burlapBoots')
bpy.context.view_layer.update()


for pb in rig.pose.bones: pb.matrix_basis = Matrix()
for name in FILES:
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True); bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{name}.glb', use_selection=True, export_animations=False,
        export_skins=True, export_image_format='JPEG', export_jpeg_quality=85)
