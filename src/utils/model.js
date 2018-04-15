/* While mapping objects to a DOM element, it's useful to have a bounding box
to reference. Enabling this flag will produce just that, a 2D bounding rect
that should match the related DOM element */
const RENDER_OBJECT_BOUNDING_BOX = false;


const normalize = obj => {
  let box = new THREE.Box3().setFromObject(obj);
  let size = new THREE.Vector3();
  box.getCenter(obj.position);
  box.getSize(size);

  let scale = 1 / Math.max(size.x, size.y);
  obj.position.multiplyScalar(-scale);
  obj.scale.set(scale, scale, scale);
  return obj;
};


const createDebugBoundingBox = obj => {
  let material = new THREE.LineBasicMaterial({color: 0x00ff00});
  let geometry = new THREE.PlaneGeometry(1, 1);
  let wireframe = new THREE.WireframeGeometry(geometry);
  let boundingBox = new THREE.LineSegments(wireframe, material);
  return boundingBox;
};


const createContainer = obj => {
  let container = new THREE.Object3D();

  if (RENDER_OBJECT_BOUNDING_BOX) {
    container.add(createDebugBoundingBox());
  }

  container.add(obj);

  return container;
};


export default {
  normalize,
  createDebugBoundingBox,
  createContainer
};
