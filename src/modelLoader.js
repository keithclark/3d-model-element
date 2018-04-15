import modelUtils from './utils/model';
import urlUtils from './utils/url';


const loaders = {};


const register = (ext, handler) => {
  loaders[ext] = {
    load: handler,
    objectCache: {}
  };
};


const load = src => {
  let loader;
  let object;
  let ext = urlUtils.getFileExtension(src);

  if (ext) {
    loader = loaders[ext];
  }

  if (!loader) {
    console.error(`Couldn't load "${src}". Unknown object format "${ext}"`);
    return Promise.reject();
  }

  object = loader.objectCache[src];
  if (!object) {
    object = loader.load(src).then(obj => {
      // To help make sizing easier to deal with we normalize the models 
      // dimenstions so its maximum width / height is 1. When rendering the
      // object we can scale it up by the width of the target DOM element.
      modelUtils.normalize(obj);

      // Finally the model is inserted into a container.
      return modelUtils.createContainer(obj);
    });
    loader.objectCache[src] = object;
  }
  
  return object.then(model => model.clone());
};


export default {
  load,
  register
};
