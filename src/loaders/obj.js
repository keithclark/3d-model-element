let loader;


export default src => {

  return new Promise((resolve, reject) => {

    const loadHandler = obj => {
      resolve(obj);
    }

    const errorHandler = () => {
      reject();
    }

    if (!loader) {
      loader = new THREE.OBJLoader();
    }

    return loader.load(src, loadHandler, null, errorHandler);

  });
}
