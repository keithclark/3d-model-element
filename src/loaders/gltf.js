let loader;

export default src => {
  return new Promise((resolve, reject) => {
    if (!loader) {
      loader = new THREE.GLTFLoader();
    }
    return loader.load(src, gltf => {
      resolve(gltf.scene);
    });
  });
}
