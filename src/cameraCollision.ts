import { Raycaster } from "three";
import type { Intersection, Object3D, Vector3 } from "three";

export function createCameraCollision() {
  const ray = new Raycaster();
  const solids: Object3D[] = [];
  const hits: Intersection[] = [];
  return (
    scene: Object3D,
    origin: Vector3,
    direction: Vector3,
    distance: number,
  ) => {
    solids.length = 0;
    hits.length = 0;
    // Filter before triangle tests. Decorative meshes and the animated player
    // cannot obstruct the camera and are often the most expensive raycasts.
    scene.traverse((object) => {
      if (object.userData.cameraSolid) solids.push(object);
    });
    ray.set(origin, direction);
    ray.far = distance;
    ray.intersectObjects(solids, false, hits);
    return hits.find((hit) => hit.distance > 0.1)?.distance;
  };
}
