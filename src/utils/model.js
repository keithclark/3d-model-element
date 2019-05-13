
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


const createContainer = obj => {
  let container = new THREE.Object3D();
  container.add(obj);
  return container;
};


export default {
  normalize,
  createContainer
};
