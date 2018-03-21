(function () {
  'use strict';

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


  var modelUtils = {
    normalize,
    createDebugBoundingBox,
    createContainer
  }

  const getFileExtension = url => {
    let path = url.split(/[?#]/)[0];
    let segments = path.split('/');
    let filename = segments.pop();
    let ext = filename.split('.');
    if (ext.length > 0) {
      return '.' + ext.pop();
    }
  };

  var urlUtils = {
    getFileExtension
  }

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

    if (!ext) {
      throw 'Unknown object format';
    }

    loader = loaders[ext];
    if (!loader) {
      throw `Unknown object format '${ext}'`;
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


  var modelLoader = {
    load,
    register
  };

  /**
   * Strips the unit from a value (i.e. 100.55px) and converts the remaining
   * value to a number.
   */
  const parseUnitValue = value => {
    return parseFloat(value || 0);
  };


  /**
   * Parses a CSS origin string (`perspective-origin`, `transform-origin`) into
   * it's X, Y and Z components and populates the supplied THREE.Vector3 with
   * the result.
   */
  const parseOriginValue = (originString, vec3) => {
    let transformOrigin = originString.split(' ');
    vec3.set(
      parseUnitValue(transformOrigin[0]),
      parseUnitValue(transformOrigin[1]),
      parseUnitValue(transformOrigin[2])
    );
  };


  /**
   * Parses a CSS 3x2 matrix() or 4x4 matrix3d() string into its compontents and 
   * populates the passed THREE.Matrix4 with the result.
   * 
   * (https://keithclark.co.uk/articles/calculating-element-vertex-data-from-css-transforms/)
   */

    const parseTransformValue = (matrixString, mat4) => {
      var c = matrixString.split(/\s*[(),]\s*/).slice(1, -1);

      if (c.length === 6) {
        // 'matrix()' (3x2)
        mat4.set(
          +c[0], -c[2],      0,  +c[4],
          -c[1], +c[3],      0,  -c[5],
              0,     0,      1,      0,
              0,     0,      0,      1
        );
      } else if (c.length === 16) { 
        // matrix3d() (4x4)
        mat4.set(
          +c[0], -c[4],  +c[8], +c[12],
          -c[1], +c[5],  -c[9], -c[13],
          +c[2], -c[6], +c[10], +c[14],
          +c[3], +c[7], +c[11], +c[15]
        );
      } else {
        // handle 'none' or invalid values.
        mat4.identity();
      }
    };

  var cssUtils = {
    parseTransformValue,
    parseOriginValue,
    parseUnitValue
  }

  /**
   * Resolves and returns the transform and perspective properties for a given
   * element. 
   */

  const getTransformForElement = elem => {
    let m1 = new THREE.Matrix4();
    let transformMatrix = new THREE.Matrix4();
    let transformOrigin = new THREE.Vector3();
    let transformOriginMatrix = new THREE.Matrix4();
    let perspectiveOrigin = new THREE.Vector3();
    let osParent = elem;
    let stack = [];
    let posX = 0;
    let posY = 0;
    let perspective = 0;

    // if this element doesn't have a width or height bail out now.
    if (elem.offsetWidth === 0 || elem.offsetHeight === 0) {
      return {
        matrix: m1
      };
    }

    posX -= elem.offsetWidth / 2;
    posY += elem.offsetHeight / 2;

    // We need to apply transforms from the root so we walk up the DOM tree,
    // pushing each node onto a stack. While we're walking to the DOM we also
    // resolve the elements X/Y position.
    while (elem) {
      if (elem === osParent) {
        posX += elem.offsetLeft;
        posY += elem.offsetTop;
        osParent = elem.offsetParent;
      }
      stack.push(elem);
      posX -= elem.scrollLeft;
      posY -= elem.scrollTop;
      elem = elem.parentElement;
    }


    m1.makeTranslation(posX, -posY, 0);

    // Now we can resolve transforms.
    while (elem = stack.pop()) {

      let style = getComputedStyle(elem);

      // TODO: It's possible to nest perspectives. Need to research the impact
      // of this and, if possible, how to emulate it. For now, we'll just use
      // the last value found.
      let perspectiveValue = style.perspective;
      if (perspectiveValue !== 'none') {
        perspective = cssUtils.parseUnitValue(perspectiveValue);

        // TODO: strictly speaking, `perspective-origin` can be set on any
        // element, not just the one that has `perspective`. Research the impact
        // of setting perspective-origin on different elements in the DOM tree.
        let perspectiveOriginValue = style.perspectiveOrigin;
        if (perspectiveOriginValue) {
          cssUtils.parseOriginValue(perspectiveOriginValue, perspectiveOrigin);
        }
      }

      cssUtils.parseOriginValue(style.transformOrigin, transformOrigin);
      cssUtils.parseTransformValue(style.transform, transformMatrix);

      let ox = transformOrigin.x - elem.offsetWidth / 2;
      let oy = transformOrigin.y - elem.offsetHeight / 2;
      let oz = transformOrigin.z;

      // If the computed `transform-origin` is a value other than `50% 50% 0`
      // (`0,0,0` in THREE coordinate space) then we need to translate by the
      // origin before multiplying the element's transform matrix. Finally, we
      // need undo the translation.
      if (ox !==0 || oy !==0 || oz !== 0) {
        m1.multiply(transformOriginMatrix.makeTranslation(ox, -oy, oz));
        m1.multiply(transformMatrix);
        m1.multiply(transformOriginMatrix.makeTranslation(-ox, oy, -oz));
      } else {
        m1.multiply(transformMatrix);
      }
    }

    return {
      matrix: m1,
      perspective: perspective,
      perspectiveOrigin: perspectiveOrigin
    };
  };


  var domUtils = {
    getTransformForElement
  }

  let camera;
  let overlayWidth;
  let overlayHeight;
  let perspectiveCamera;
  let orthographicCamera;
  let renderer;
  let scene;
  let light;


  const init = () => {

    // create the scene
    scene = new THREE.Scene();

    // add a light
    light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 0, 1);
    scene.add(light);

    // create the WebGL renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.domElement.style.cssText = 'pointer-events:none;position:fixed;top:0;left:0;';
    document.documentElement.appendChild(renderer.domElement);
  };


  const add = obj => {
    if (!scene) {
      init();
      requestAnimationFrame(render);
    }
    scene.add(obj);
  };


  const remove = (obj) => {
    scene.remove(obj);
  };


  const update = () => {
    let needsRender = false;

    overlayWidth = window.innerWidth;
    overlayHeight = window.innerHeight;
    camera = null;

    // Walk over each object and update it
    scene.children.forEach(child => {
      let elem = child.elem;
      if (elem) {

        let width = elem.offsetWidth;
        let transform = domUtils.getTransformForElement(elem);

        // If we haven't yet figured out which type of camera to use for
        // projecting the scene, do it now. If the current element doesn't have
        // a parent with a `perspective`, we use orthographic projection.
        if (!camera) {
          if (transform.perspective) {
            camera = setPerspectiveCamera(transform.perspective, transform.perspectiveOrigin);
          } else {
            camera = setOrthographicCamera();
          }
        }

        // Apply the transform matrix of them DOM node to the model
        child.rotation.setFromRotationMatrix(transform.matrix);
        child.position.setFromMatrixPosition(transform.matrix);
        child.scale.setFromMatrixScale(transform.matrix);

        // Objects are normalised so we can scale them up by their width to
        // render them at the intended size
        child.scale.multiplyScalar(width);

        // Three's coordinate space uses 0,0,0 as the screen centre so we need
        // to adjust the computed X/Y position back to the top-left of the
        // screen to match the CSS rendering position.
        child.position.x += width - overlayWidth / 2;      child.position.y += overlayHeight / 2;
      }

      // TODO: determine if this object is visible the viewport and set the
      // `needsRender` flag accordingly
      if (!needsRender) {
        needsRender = true;
      }
    });

    return needsRender;
  };


  const setOrthographicCamera = () => {
    let camera;
    
    if (!orthographicCamera) {
      orthographicCamera = new THREE.OrthographicCamera();
    } 
    
    camera = orthographicCamera;
    camera.left = -overlayWidth / 2;  camera.right = overlayWidth / 2;  camera.top = overlayHeight / 2;
    camera.bottom = -overlayHeight / 2;
    camera.far = 2000;
    camera.near = -700;
    camera.updateProjectionMatrix();

    return camera;
  };


  const setPerspectiveCamera = (perspective, perspectiveOrigin) => {
    let camera;
    
    if (!perspectiveCamera) {
      perspectiveCamera = new THREE.PerspectiveCamera();
    }

    camera = perspectiveCamera;
    camera.fov = 180 * (2 * Math.atan(overlayHeight / 2 / perspective)) / Math.PI;
    camera.aspect = overlayWidth / overlayHeight;
    camera.position.set(0, 0, perspective);
    camera.updateProjectionMatrix();

    // Add perspective-origin
    let originX = overlayWidth / 2 - perspectiveOrigin.x;
    let originY = overlayHeight / 2 - perspectiveOrigin.y;

    // The default is origin for perspective is `50% 50%`, which equates to
    // `0,0`. If the author hasn't specified a different value we don't need
    // to make any adjustments to the projection matrix
    if (originX !==0 || originY !== 0) {

      // copy the projection matrix
      let tmpMatrix = camera.projectionMatrix.clone();

      // set the camera projection matrix to the origin
      camera.projectionMatrix.makeTranslation(
        -originX / (overlayWidth / 2),
        originY / (overlayHeight / 2),
        0
      );

      // apply to original camera projection matrix
      camera.projectionMatrix.multiply(tmpMatrix);

      // remove the origin offset
      tmpMatrix.makeTranslation(originX, -originY, 0);
      camera.projectionMatrix.multiply(tmpMatrix);
    }

    return camera;
  };


  const render = () => {
    requestAnimationFrame(render);

    if (update()) {
      renderer.setSize(overlayWidth, overlayHeight);
      renderer.render(scene, camera);
    }};


  var modelLayer = {
    add,
    remove,
    render
  }

  class HTMLModelElement extends HTMLElement {

    constructor() {
      super();
    }

    static get observedAttributes() {
      return ['src'];
    }

    connectedCallback() {

    }

    disconnectedCallback() {
    }

    attributeChangedCallback(attribute, oldValue, newValue) {
      if (attribute === 'src') {
        modelLoader.load(newValue).then(obj => {
          obj.elem = this;
          modelLayer.add(obj);
        });
      }
    }

  }

  let loader;

  var objLoader = src => {
    return new Promise((resolve, reject) => {
      if (!loader) {
        loader = new THREE.OBJLoader();
      }
      return loader.load(src, obj => {
        resolve(obj);
      });
    });
  }

  if ('customElements' in window) {

    if (!('THREE' in window)) {
      throw 'THREE (threejs.org) is required.';
    }

    if ('OBJLoader' in THREE) {
      modelLoader.register('.obj', objLoader);
    }

    customElements.define('x-model', HTMLModelElement);
  }

}());
