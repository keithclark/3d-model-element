let loader;


export default src => {

  return new Promise((resolve, reject) => {

    const loadHandler = gltf => {
      resolve(gltf.scene);
    }

    const errorHandler = () => {
      reject();
    }

    if (!loader) {
      loader = new THREE.GLTFLoader();
    }

    return loader.load(src, loadHandler, null, errorHandler);

  });
}
