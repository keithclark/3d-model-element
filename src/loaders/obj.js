let loader;

export default src => {
  return new Promise((resolve, reject) => {
    if (!loader) {
      loader = new THREE.OBJLoader();
    }
    return loader.load(src, obj => {
      resolve(obj);
    });
  });
}