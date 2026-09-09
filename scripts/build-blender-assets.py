"""Run with blender.exe --background --factory-startup --python-exit-code 1
--python scripts/build-blender-assets.py (all arguments on one command line).

Blender Z-up coordinates use -Y as the character's front (glTF +Z).
Assets are joined by material to keep the browser's draw calls small.
"""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client/public/models"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "art"
SOURCE.mkdir(exist_ok=True)


def material(name, color, roughness=0.8):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is None:
        shader = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        output = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def ellipsoid(name, pos, scale, mat, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if name == "branch joint" else segments,
                                       ring_count=6 if name == "branch joint" else rings, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    for face in obj.data.polygons:
        face.use_smooth = True
    return finish(obj, name, mat)


def box(name, pos, scale, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft crafted edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, name, mat)


def limb(name, start, end, radius, mat, tip=None):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius,
                                   radius2=radius if tip is None else tip,
                                   depth=direction.length,
                                   location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return finish(obj, name, mat)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def sculpted_hair(mat, doll=False):
    """One closed cap with broad swept ridges; no intersecting spherical locks."""
    vertices, faces = [], []
    rows, columns = 20, 64
    for row in range(rows + 1):
        t = row / rows
        for col in range(columns):
            phi = col * math.tau / columns
            front = max(0, -math.sin(phi))
            fringe = front ** 2
            hairline = 2.18 - 0.85 * fringe + 0.035 * math.cos(phi * 8)
            theta = 0.003 + t * hairline
            sweep = phi + (0.12 if doll else 0.55) * (1 - t)
            ridge = 1 + (0.035 if doll else 0.075) * math.cos(8 * sweep) * math.sin(theta) ** 1.4
            vertices.append(((0.318 if doll else 0.35) * ridge * math.sin(theta) * math.cos(phi),
                             (0.33 if doll else 0.36) * ridge * math.sin(theta) * math.sin(phi),
                             1.24 + (0.306 if doll else 0.337) * math.cos(theta)))
    for row in range(rows):
        for col in range(columns):
            a = row * columns + col
            b = row * columns + (col + 1) % columns
            faces.append((a, a + columns, b + columns, b))
    faces.append(tuple(reversed(range(columns))))
    mesh = bpy.data.meshes.new("sculpted swept hair")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("continuous swept hair cap", mesh)
    bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    finish(obj, obj.name, mat)
    # A rim follows the hairline; a non-planar bottom ngon would cut across the face.
    bpy.context.view_layer.objects.active = obj
    rim = obj.modifiers.new("Hairline thickness", "SOLIDIFY")
    rim.thickness = 0.012
    rim.offset = -1
    bpy.ops.object.modifier_apply(modifier=rim.name)


def rounded_face(name, center, scale, mat):
    obj = ellipsoid(name, center, scale, mat, 40, 28)
    # Flatten the front gently into broad cheeks, rather than placing features on a ball.
    for vertex in obj.data.vertices:
        if vertex.co.y < 0:
            vertex.co.y = -abs(vertex.co.y) ** 0.72
        if vertex.co.z < 0:
            vertex.co.x *= 1 + 0.09 * math.sin(-vertex.co.z * math.pi)
    obj.data.update()
    return obj


def smooth_fabric(mat, prefixes):
    """Fuse shoulders into the jacket, then soften the seam without a skeletal rig."""
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"
               and o.data.materials[0] == mat and o.name.startswith(prefixes)]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    remesh = obj.modifiers.new("Continuous tailored fabric", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.012
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new("Soft cloth transitions", "SMOOTH")
    smooth.factor = 1.15
    smooth.iterations = 6
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = obj.modifiers.new("Game mesh budget", "DECIMATE")
    decimate.ratio = 0.32
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def curved_tube(name, points, radii, mat, sides=10):
    vertices, faces = [], []
    points = [Vector(point) for point in points]
    for index, point in enumerate(points):
        tangent = points[min(index + 1, len(points) - 1)] - points[max(0, index - 1)]
        rotation = tangent.to_track_quat("Z", "Y")
        for side in range(sides):
            angle = side * math.tau / sides
            offset = rotation @ Vector((math.cos(angle) * radii[index], math.sin(angle) * radii[index], 0))
            vertices.append(tuple(point + offset))
    for row in range(len(points) - 1):
        for side in range(sides):
            a, b = row * sides + side, row * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + i for i in range(sides))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return finish(obj, name, mat)


def fabric_stripe(name, side, center_x, center_z, rx, ry, rz, z_min, z_max, mat):
    vertices, faces = [], []
    for row in range(13):
        z = z_min + (z_max - z_min) * row / 12
        for y in [-0.021, 0.021]:
            x = center_x + rx * math.sqrt(max(0, 1 - (y / ry) ** 2 - ((z - center_z) / rz) ** 2)) + 0.003
            vertices.append((side * x, y, z))
    for row in range(12):
        a = row * 2
        face = (a, a + 1, a + 3, a + 2)
        faces.append(face if side == 1 else tuple(reversed(face)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    finish(obj, name, mat)


def export(name):
    if name == "player":
        # Bake the solid palette to COLOR_0 for a single instanced mesh in Three.js.
        objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        head_parts = ("continuous swept hair", "round head", "ear", "eye", "soft eyebrow", "nose", "mouth")
        for obj in objects:
            inverse = obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                world = obj.matrix_world @ vertex.co
                if obj.name.startswith(head_parts):
                    world.x *= 1.08
                    world.y *= 1.08
                    world.z = 1.11 + (world.z - 1.2) * 1.08
                else:
                    world.z *= 0.9
                vertex.co = inverse @ world
            obj.data.update()
        bpy.context.view_layer.update()
        # Short-range ambient occlusion stays soft even with a stadium-sized shadow map.
        vertices, polygons = [], []
        for obj in objects:
            offset = len(vertices)
            vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
            polygons.extend(tuple(offset + i for i in polygon.vertices) for polygon in obj.data.polygons)
        surface = BVHTree.FromPolygons(vertices, polygons)
        rays = []
        for i in range(16):
            z = (i + 0.5) / 16
            angle = i * 2.39996323
            radius = math.sqrt(1 - z * z)
            rays.append(Vector((radius * math.cos(angle), radius * math.sin(angle), z)))
        for obj in objects:
            colors = obj.data.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
            base = obj.data.materials[0].diffuse_color
            normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
            shades = []
            for vertex in obj.data.vertices:
                normal = (normal_matrix @ vertex.normal).normalized()
                origin = obj.matrix_world @ vertex.co + normal * 0.004
                rotation = normal.to_track_quat("Z", "Y")
                occlusion = 0
                for ray in rays:
                    hit, _, _, distance = surface.ray_cast(origin, rotation @ ray, 0.22)
                    if hit is not None:
                        occlusion += 1 - distance / 0.22
                shades.append(0.98 - 0.48 * occlusion / len(rays))
            for loop, color in zip(obj.data.loops, colors.data):
                shade = shades[loop.vertex_index]
                color.color = (base[0] * shade, base[1] * shade, base[2] * shade, 1)
        bpy.ops.object.select_all(action="SELECT")
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.data.materials.clear()
        mat = material("player vertex palette", (1, 1, 1))
        vertex = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        vertex.layer_name = "Color"
        shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
        mat.node_tree.links.new(vertex.outputs["Color"], shader.inputs["Base Color"])
        obj.data.materials.append(mat)
        for polygon in obj.data.polygons:
            polygon.material_index = 0
    # Merge separate decorative pieces into one mesh per material.
    groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH":
            groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for key, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = f"{name}_{key}"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{name}.blend"))
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{name}.glb"),
                              export_format="GLB", export_yup=True,
                              export_animations=False, export_cameras=False,
                              export_lights=False)
    triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
                    for o in bpy.context.scene.objects if o.type == "MESH")
    print(f"ASSET {name}: {triangles} triangles, {(OUT / f'{name}.glb').stat().st_size} bytes")


reset()
skin = material("warm porcelain", (0.83, 0.58, 0.36), 0.65)
hair = material("espresso hair", (0.055, 0.036, 0.025), 0.38)
shirt = material("marigold blouse", (0.95, 0.55, 0.06))
dress = material("burnt orange dress", (0.92, 0.28, 0.025), 0.67)
cream = material("ivory socks and collar", (0.9, 0.85, 0.66))
dark = material("shoes and pupils", (0.025, 0.025, 0.023), 0.45)
rose = material("muted lips", (0.28, 0.065, 0.045))
iris = material("natural brown iris", (0.07, 0.045, 0.023), 0.4)
ribbon = material("muted violet ribbon", (0.21, 0.12, 0.26))

for side in [-1, 1]:
    x = side * 0.115
    limb("leg", (x, 0, 0.12), (x, 0, 0.48), 0.069, skin)
    limb("sock", (x, 0, 0.1), (x, 0, 0.26), 0.073, cream)
    ellipsoid("Mary Jane shoe", (x, -0.048, 0.067), (0.09, 0.145, 0.067), dark)
    box("shoe strap", (x, -0.015, 0.124), (0.16, 0.04, 0.016), dark, 0.006)
ellipsoid("blouse", (0, 0, 0.76), (0.18, 0.125, 0.2), shirt)
# A continuous fluted skirt, rather than overlapping primitives.
vertices, faces = [], []
for z, radius in [(0.36, 0.32), (0.39, 0.325), (0.68, 0.195), (0.73, 0.19)]:
    for i in range(64):
        angle = i * math.tau / 64
        r = radius * (1 + 0.035 * math.cos(angle * 16))
        vertices.append((r * math.cos(angle), r * math.sin(angle) * 0.73, z))
for row in range(3):
    for i in range(64):
        a, b = row * 64 + i, row * 64 + (i + 1) % 64
        faces.append((a, b, b + 64, a + 64))
faces.extend([tuple(reversed(range(64))), tuple(range(192, 256))])
mesh = bpy.data.meshes.new("pleated skirt")
mesh.from_pydata(vertices, [], faces)
obj = bpy.data.objects.new("pleated skirt", mesh)
bpy.context.collection.objects.link(obj)
for polygon in mesh.polygons:
    polygon.use_smooth = len(polygon.vertices) == 4
finish(obj, "pleated skirt", dress)
box("pinafore bib", (0, -0.137, 0.76), (0.27, 0.035, 0.22), dress)
for side in [-1, 1]:
    x = side * 0.12
    box("shoulder strap", (x, -0.13, 0.87), (0.055, 0.037, 0.18), dress, 0.01)
    ellipsoid("button", (x, -0.16, 0.825), (0.018, 0.01, 0.018), cream)
    collar = box("collar", (side * 0.065, -0.14, 0.94), (0.12, 0.035, 0.07), cream, 0.012)
    collar.rotation_euler.y = side * 0.25
    ellipsoid("puff sleeve", (side * 0.255, 0, 0.84), (0.095, 0.11, 0.115), shirt)
    limb("forearm", (side * 0.27, 0, 0.78), (side * 0.32, -0.015, 0.5), 0.061, skin, 0.052)
    ellipsoid("hand", (side * 0.32, -0.017, 0.48), (0.063, 0.05, 0.085), skin)
limb("neck", (0, 0, 0.91), (0, 0, 1.06), 0.085, skin)
rounded_face("porcelain face", (0, -0.047, 1.2), (0.278, 0.239, 0.276), skin)
sculpted_hair(hair, doll=True)
for side in [-1, 1]:
    ellipsoid("ear", (side * 0.267, -0.025, 1.2), (0.042, 0.055, 0.07), skin)
    ellipsoid("low pigtail", (side * 0.285, 0.05, 1.055), (0.11, 0.1, 0.09), hair)
    ellipsoid("violet hair tie", (side * 0.275, -0.012, 1.12), (0.035, 0.025, 0.03), ribbon)
    ellipsoid("round eye", (side * 0.096, -0.277, 1.232), (0.043, 0.018, 0.048), cream)
    ellipsoid("brown iris", (side * 0.096, -0.294, 1.231), (0.032, 0.009, 0.039), iris)
    ellipsoid("pupil", (side * 0.096, -0.302, 1.231), (0.022, 0.005, 0.03), dark)
    ellipsoid("eye glint", (side * 0.096 - 0.011, -0.308, 1.248), (0.01, 0.004, 0.011), cream)
    limb("natural brow inner", (side * 0.054, -0.277, 1.278), (side * 0.094, -0.271, 1.287), 0.0045, hair)
    limb("natural brow outer", (side * 0.094, -0.271, 1.287), (side * 0.14, -0.249, 1.277), 0.0045, hair, 0.002)
ellipsoid("small nose", (0, -0.293, 1.175), (0.018, 0.022, 0.027), skin)
ellipsoid("upper lip", (0, -0.28, 1.106), (0.03, 0.005, 0.006), rose)
ellipsoid("lower lip", (0, -0.279, 1.092), (0.026, 0.005, 0.006), rose)
ellipsoid("slightly parted mouth", (0, -0.283, 1.099), (0.023, 0.002, 0.003), dark)
clip = box("violet hair clip", (0.17, -0.216, 1.427), (0.065, 0.015, 0.016), ribbon, 0.005)
clip.rotation_euler.z = 0.55
smooth_fabric(shirt, ("blouse", "puff sleeve"))
export("doll")

for kind in ["guard", "player"]:
    reset()
    is_guard = kind == "guard"
    suit = material(f"{kind} fabric", (0.82, 0.018, 0.17) if is_guard else (0.008, 0.255, 0.225), 0.68)
    seam = material(f"{kind} fabric seams", (0.43, 0.012, 0.085) if is_guard else (0.008, 0.18, 0.15))
    rubber = material(f"{kind} black rubber", (0.009, 0.013, 0.018))
    stripe = material(f"{kind} ivory details", (0.88, 0.88, 0.76))

    def oval(name, pos, scale, mat):
        return ellipsoid(name, pos, scale, mat, 24 if is_guard else 20, 16 if is_guard else 12)

    oval("jacket torso", (0, 0, 0.67), (0.283, 0.222, 0.27), suit)
    oval("soft ribbed jacket hem", (0, 0, 0.465), (0.235, 0.198, 0.055), seam)
    for side in [-1, 1]:
        x = side * 0.12
        oval("trouser leg", (x, 0, 0.28), (0.103, 0.115, 0.22), suit)
        limb("ankle cuff", (x, 0, 0.09), (x, 0, 0.15), 0.092, seam)
        oval("shoe sole", (x, -0.045, 0.035), (0.109, 0.155, 0.033), rubber if is_guard else stripe)
        oval("boot" if is_guard else "sneaker", (x, -0.04, 0.085), (0.104, 0.148, 0.069), rubber if is_guard else stripe)
        oval("shoulder", (side * 0.255, 0, 0.765), (0.116, 0.119, 0.15), suit)
        if is_guard:
            elbow = (side * 0.29, -0.16, 0.64)
            hand = (0.1, -0.39, 0.71) if side == 1 else (0.07, -0.62, 0.75)
            limb("bent upper sleeve", (side * 0.27, 0, 0.79), elbow, 0.086, suit)
            oval("elbow", elbow, (0.087, 0.087, 0.087), suit)
            limb("raised forearm", elbow, hand, 0.082, suit, 0.065)
            oval("supporting black glove", hand, (0.069, 0.079, 0.062), rubber)
        else:
            oval("sleeve", (side * 0.31, 0, 0.66), (0.089, 0.1, 0.19), suit)
            limb("wrist cuff", (side * 0.33, 0, 0.46), (side * 0.325, 0, 0.52), 0.08, seam)
            oval("hand", (side * 0.335, -0.008, 0.435), (0.077, 0.062, 0.081), skin)
        if not is_guard:
            for z, width in [(0.55, 0.17), (0.59, 0.15)]:
                curved_tube("soft jacket fold", [(side * 0.06, -0.197, z), (side * 0.13, -0.202, z + 0.012),
                             (side * width, -0.175, z + 0.03)], [0.003, 0.009, 0.002], suit, 8)
            fabric_stripe("trouser white stripe", side, 0.12, 0.28, 0.103, 0.115, 0.22, 0.14, 0.44, stripe)
            fabric_stripe("sleeve white stripe", side, 0.31, 0.66, 0.089, 0.1, 0.19, 0.52, 0.81, stripe)
            for lace in range(3):
                box("shoe lace", (x, -0.094 + lace * 0.026, 0.143), (0.1, 0.01, 0.009), seam, 0.003)
    curved_tube("center zipper", [(0, -0.222 * math.sqrt(1 - ((z - 0.67) / 0.27) ** 2) - 0.006, z)
                 for z in [0.51, 0.56, 0.61, 0.66, 0.71, 0.76, 0.81, 0.86]],
                 [0.005] * 8, rubber if is_guard else stripe, 6)
    box("zipper pull", (0, -0.224, 0.85), (0.021, 0.014, 0.035), rubber if is_guard else stripe, 0.005)
    if is_guard:
        # Entirely enclosed hood and mask: deliberately no skin, ears, or nose.
        oval("enclosed pink hood", (0, 0.015, 1.17), (0.31, 0.275, 0.34), suit)
        oval("hood opening trim", (0, -0.176, 1.17), (0.258, 0.132, 0.283), seam)
        curved_tube("hood crown seam", [(0, 0.22, 1.06), (0, 0.28, 1.25), (0, 0.17, 1.46),
                     (0, -0.02, 1.511), (0, -0.19, 1.39)], [0.006] * 5, seam, 8)
        ellipsoid("featureless black faceplate", (0, -0.24, 1.17), (0.237, 0.09, 0.258), rubber, 32, 20)
        for start, end in [((-0.094, -0.337, 1.1), (0, -0.337, 1.284)),
                           ((0, -0.337, 1.284), (0.094, -0.337, 1.1)),
                           ((0.094, -0.337, 1.1), (-0.094, -0.337, 1.1))]:
            limb("white triangle mask insignia", start, end, 0.008, stripe)
        box("utility belt", (0, -0.008, 0.51), (0.46, 0.36, 0.055), rubber, 0.015)
        box("belt buckle", (0, -0.2, 0.51), (0.085, 0.04, 0.065), seam, 0.01)
        box("chest pocket", (0.135, -0.199, 0.75), (0.11, 0.025, 0.1), seam, 0.012)
        # Stylized static prop; local -Y becomes +Z in glTF, facing downfield after the guard's turn.
        gunmetal = material("machine gun charcoal", (0.035, 0.045, 0.05), 0.56)
        box("machine gun stock", (0.1, -0.18, 0.79), (0.085, 0.24, 0.125), rubber, 0.014)
        box("heavy machine gun body", (0.1, -0.42, 0.815), (0.115, 0.3, 0.13), gunmetal, 0.012)
        box("machine gun foregrip", (0.1, -0.64, 0.8), (0.085, 0.18, 0.075), rubber, 0.01)
        box("box ammunition container", (-0.01, -0.45, 0.69), (0.19, 0.18, 0.2), gunmetal, 0.015)
        box("ammunition box lid", (-0.01, -0.45, 0.787), (0.2, 0.19, 0.025), rubber, 0.005)
        for y in [-0.36, -0.51]:
            box("carry handle support", (0.1, y, 0.917), (0.02, 0.02, 0.075), gunmetal, 0.004)
        box("top carry handle", (0.1, -0.435, 0.95), (0.03, 0.19, 0.025), rubber, 0.006)
        limb("heavy barrel shroud", (0.1, -0.69, 0.82), (0.1, -0.94, 0.82), 0.039, gunmetal)
        for i in range(5):
            for side in [-1, 1]:
                box("dark shroud vent", (0.1 + side * 0.038, -0.72 - i * 0.043, 0.82),
                    (0.004, 0.021, 0.025), rubber, 0.003)
        limb("machine gun muzzle", (0.1, -0.93, 0.82), (0.1, -1.04, 0.82), 0.027, rubber)
        box("front sight", (0.1, -0.91, 0.87), (0.015, 0.025, 0.055), gunmetal, 0.003)
    else:
        limb("neck", (0, 0, 0.9), (0, 0, 1.025), 0.09, skin)
        rounded_face("round head", (0, -0.045, 1.2), (0.315, 0.265, 0.302), skin)
        sculpted_hair(hair)
        for side in [-1, 1]:
            oval("ear", (side * 0.302, -0.025, 1.175), (0.044, 0.05, 0.066), skin)
            oval("eye", (side * 0.108, -0.305, 1.221), (0.035, 0.018, 0.047), dark)
            oval("eye highlight", (side * 0.108 - 0.01, -0.323, 1.239), (0.009, 0.004, 0.011), stripe)
            curved_tube("soft eyebrow", [(side * 0.076, -0.302, 1.296), (side * 0.103, -0.301, 1.307),
                         (side * 0.132, -0.288, 1.302)], [0.003, 0.005, 0.002], hair, 6)
            collar = box("jacket collar", (side * 0.06, -0.142, 0.91), (0.1, 0.048, 0.073), stripe, 0.012)
            collar.rotation_euler.y = side * 0.3
        oval("nose", (0, -0.316, 1.168), (0.026, 0.022, 0.028), skin)
        oval("mouth", (0, -0.303, 1.108), (0.025, 0.006, 0.007), rose)
        box("chest badge", (0.126, -0.212, 0.77), (0.093, 0.015, 0.055), stripe, 0.005)
    if not is_guard:
        smooth_fabric(suit, ("jacket torso", "shoulder", "sleeve", "soft jacket fold"))
    export(kind)

reset()
bark = material("weathered bark", (0.20, 0.115, 0.057))
bark_light = material("bark ridges", (0.29, 0.18, 0.09))
rng = random.Random(84)


def branch(start, end, radius, depth):
    start, end = Vector(start), Vector(end)
    delta = end - start
    bend = Vector((rng.uniform(-0.22, 0.22), rng.uniform(-0.25, 0.25), rng.uniform(-0.1, 0.15))) * delta.length
    points = [start.lerp(end, i / 6) + bend * math.sin(i / 6 * math.pi) for i in range(7)]
    radii = [radius * (1 - i / 6 * 0.5) for i in range(7)]
    curved_tube("organic tapered branch", points, radii, bark, 12 if radius > 0.2 else 7)
    if radius > 0.06:
        ellipsoid("rounded branch union", end, (radius * 0.51,) * 3, bark, 16, 10)
    if depth:
        for side in [-1, 1]:
            delta = Vector(end) - Vector(start)
            angle = side * rng.uniform(0.25, 0.85)
            dx = delta.x * math.cos(angle) - delta.z * math.sin(angle)
            dz = delta.x * math.sin(angle) + delta.z * math.cos(angle)
            next_end = Vector(end) + Vector((dx, delta.y + rng.uniform(-0.5, 0.5), dz)) * rng.uniform(0.58, 0.78)
            branch(end, next_end, radius * 0.49, depth - 1)


curved_tube("buttressed trunk", [(0, 0, 0.02), (-0.12, 0.06, 0.45), (0.06, 0, 1.1),
             (0.24, 0.12, 2), (0.05, 0.04, 2.8), (0.15, 0, 3.5)],
             [1.05, 0.77, 0.64, 0.52, 0.48, 0.43], bark, 20)
for end, start, radius, depth in [((-0.4, 0.2, 5.8), (0.15, 0, 3.5), 0.43, 5),
                                  ((-2.3, -0.1, 4.5), (0.1, 0, 2.7), 0.37, 5),
                                  ((2.8, 0.5, 5.3), (0.15, 0, 3.5), 0.35, 5),
                                  ((1.1, -0.65, 6.4), (0.05, 0.04, 2.8), 0.3, 4)]:
    branch(start, end, radius, depth)
for i in range(9):
    a = i * math.tau / 9
    curved_tube("spreading root", [(math.cos(a) * 2, math.sin(a) * 1.6, 0.025),
                 (math.cos(a) * 1.1, math.sin(a) * 0.9, 0.12), (math.cos(a) * 0.45, math.sin(a) * 0.45, 0.7)],
                 [0.025, 0.18, 0.32], bark, 10)
for i in range(15):
    a = i * math.tau / 15
    limb("trunk fluting", (math.cos(a) * 0.57, math.sin(a) * 0.57, 0.2),
         (0.13 + math.cos(a) * 0.32, math.sin(a) * 0.32, 3.3), 0.032, bark_light, 0.012)
export("tree")

reset()
plaster = material("warm plaster", (0.87, 0.84, 0.72))
trim = material("limestone trim", (0.95, 0.91, 0.8))
wood = material("sage doors", (0.12, 0.23, 0.16))
glass = material("dark teal glass", (0.055, 0.13, 0.13), 0.24)
roof = material("terracotta", (0.6, 0.135, 0.032))
tile = material("sunlit terracotta", (0.84, 0.25, 0.055))
box("foundation", (0, 0, 0.1), (3.7, 2.8, 0.2), trim)
box("plaster walls", (0, 0, 1.23), (3.5, 2.6, 2.26), plaster)
box("door frame", (0, 1.325, 0.98), (1.3, 0.12, 1.94), trim)
box("door", (0, 1.399, 0.95), (1.08, 0.055, 1.8), wood)
for x in [-0.35, -0.175, 0, 0.175, 0.35]:
    box("door panel", (x, 1.433, 0.97), (0.015, 0.012, 1.64), trim, 0.002)
ellipsoid("door knob", (0.36, 1.47, 0.95), (0.035, 0.03, 0.035), roof)
for side in [-1, 1]:
    x = side * 1.12
    box("window casing", (x, 1.33, 1.35), (0.72, 0.13, 0.91), trim)
    box("window glass", (x, 1.405, 1.35), (0.56, 0.035, 0.75), glass)
    box("window mullion", (x, 1.432, 1.35), (0.04, 0.025, 0.76), wood, 0.005)
    box("window crossbar", (x, 1.432, 1.35), (0.57, 0.025, 0.04), wood, 0.005)
    box("window sill", (x, 1.44, 0.88), (0.82, 0.26, 0.09), trim)
    # Continuous gable end beneath the sloped roof.
    vertices = [(side * 1.75, -1.3, 2.36), (side * 1.75, 1.3, 2.36), (side * 1.75, 0, 3.08)]
    mesh = bpy.data.meshes.new("gable")
    mesh.from_pydata(vertices, [], [(0, 1, 2) if side == 1 else (2, 1, 0)])
    obj = bpy.data.objects.new("gable", mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, "gable", plaster)
    panel = box("roof slope", (0, side * 0.76, 2.72), (3.98, 1.78, 0.12), roof)
    panel.rotation_euler.x = -side * 0.48
    for col in range(19):
        for row in range(4):
            y = side * (0.18 + row * 0.39)
            z = 3.17 - abs(y) * math.tan(0.48)
            limb("individual roof tile", (-1.9 + col * 0.21, y - side * 0.2, z + 0.1),
                 (-1.9 + col * 0.21, y + side * 0.2, z - 0.1), 0.065, tile)
limb("ridge cap", (-2, 0, 3.18), (2, 0, 3.18), 0.105, tile)
box("doorstep", (0, 1.58, 0.09), (1.48, 0.48, 0.18), trim)
export("house")
