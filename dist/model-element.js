//! 3D Model Element v1.0.2 | (C) Keith Clark | MIT | https://github.com/keithclark/3d-model-element

(function () {
  'use strict';

  const normalize = obj => {
    let box = new THREE.Box3().setFromObject(obj);
    let size = new THREE.Vector3();
    box.getCenter(obj.position);
    box.getSize(size);

    let scale = 1 / Math.max(size.x, size.y);
    obj.position.multiplyScalar(-scale);
    obj.scale.multiplyScalar(scale);
    obj.userData.size = size.multiplyScalar(scale).clone();
    return obj;
  };


  const createContainer = obj => {
    let container = new THREE.Object3D();
    container.add(obj);
    return container;
  };


  var modelUtils = {
    normalize,
    createContainer
  };

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
  };

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
  };

  /**
   * Resolves and returns the transform and perspective properties for a given
   * element.
   */

  const getTransformForElement = elem => {
    let m1 = new THREE.Matrix4();
    let transformMatrix = new THREE.Matrix4();
    let transformOrigin = new THREE.Vector3();
    let transformOriginMatrix = new THREE.Matrix4();
    let osParent = elem;
    let stack = [];
    let posX = 0;
    let posY = 0;



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
      cssUtils.parseOriginValue(style.transformOrigin, transformOrigin);
      cssUtils.parseTransformValue(style.transform, transformMatrix);

      let ox = transformOrigin.x - elem.offsetWidth / 2;
      let oy = transformOrigin.y - elem.offsetHeight / 2;
      let oz = transformOrigin.z;

      // If the computed `transform-origin` is a value other than `50% 50% 0`
      // (`0,0,0` in THREE coordinate space) then we need to translate by the
      // origin before multiplying the element's transform matrix. Finally, we
      // need undo the translation.
      if (ox !== 0 || oy !== 0 || oz !== 0) {
        m1.multiply(transformOriginMatrix.makeTranslation(ox, -oy, oz));
        m1.multiply(transformMatrix);
        m1.multiply(transformOriginMatrix.makeTranslation(-ox, oy, -oz));
      } else {
        m1.multiply(transformMatrix);
      }
    }

    return m1;
  };


  const getProjectionForElement = elem => {
    let perspectiveOrigin = new THREE.Vector3();
    let perspective;
    let clipBounds = {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight
    };
    let cameraBounds = {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight
    };


    while (elem) {
      let style = getComputedStyle(elem);
      let elemBounds = elem.getBoundingClientRect();

      // TODO: It's possible to nest perspectives. Need to research the impact
      // of this and, if possible, how to emulate it. For now, we'll just use
      // the last value found.
      let perspectiveValue = style.perspective;
      if (!perspective) {
        if (perspectiveValue !== 'none') {
          perspective = cssUtils.parseUnitValue(perspectiveValue);

          cameraBounds.top = elemBounds.top;
          cameraBounds.left = elemBounds.left;
          cameraBounds.right = elemBounds.right;
          cameraBounds.bottom = elemBounds.bottom;

          // TODO: strictly speaking, `perspective-origin` can be set on any
          // element, not just the one that has `perspective`. Research the impact
          // of setting perspective-origin on different elements in the DOM tree.
          let perspectiveOriginValue = style.perspectiveOrigin;
          if (perspectiveOriginValue) {
            cssUtils.parseOriginValue(perspectiveOriginValue, perspectiveOrigin);
          }
        }
      }


      if (style.overflow !== 'visible') {
        clipBounds.top = Math.max(elemBounds.top, clipBounds.top);
        clipBounds.left = Math.max(elemBounds.left, clipBounds.left);
        clipBounds.right = Math.min(elemBounds.right, clipBounds.right);
        clipBounds.bottom = Math.min(elemBounds.bottom, clipBounds.bottom);
      }

      elem = elem.parentElement;

    }

    return {
      perspective: perspective,
      perspectiveOrigin: perspectiveOrigin,
      clipBounds: clipBounds,
      cameraBounds: cameraBounds
    };
  };



  const createStylesheet = cssText => {
    let styleElem = document.createElement('style');
    styleElem.textContent = cssText;
    return styleElem;
  };



  var domUtils = {
    getTransformForElement,
    getProjectionForElement,
    createStylesheet
  };

  let camera;
  let overlayWidth;
  let overlayHeight;
  let perspectiveCamera;
  let orthographicCamera;
  let renderer;
  let scene;
  let light;

  const objs = [];


  const init = () => {
    if (scene) {
      return false;
    }

    // create the scene
    scene = new THREE.Scene();

    // add a light
    light = new THREE.PointLight(0x808080, 2, 0);
    light.position.set(0, 0, 0);
    scene.add(light);

    /*
    var sphereSize = .5;
    var pointLightHelper = new THREE.PointLightHelper( light, sphereSize, 0xff00ff );
    scene.add( pointLightHelper );
    */

    // create the WebGL renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.sortObjects = false;
    requestAnimationFrame(render);

    return renderer.domElement;
  };


  const add = obj => {
    let index = objs.indexOf(obj);
    if (index === -1) {
      objs.push(obj);
      return true;
    }
    return false;
  };


  const remove = (obj) => {
    let index = objs.indexOf(obj);
    if (index > -1) {
      objs.splice(index, 1);
      return true;
    }
    return false;
  };


  const update = () => {
    overlayWidth = window.innerWidth;
    overlayHeight = window.innerHeight;
    camera = null;
    renderer.setSize(overlayWidth, overlayHeight);
    renderer.clear();

    // Walk over each object and update it
    objs.forEach(child => {
      let elem = child.elem;
      if (elem) {
        let projection;
        let transformMatrix;
        let clipHeight;
        let clipWidth;
        let model = child.children[0];
        let boundsElem = elem.shadowRoot.children[1];
        let size = model.userData.size;
        let elemWidth = elem.offsetWidth;
        let elemHeight = elem.offsetHeight;
        let scale = Math.min(elemWidth / size.x, elemHeight / size.y);
        let objWidth = size.x * scale;

        projection = domUtils.getProjectionForElement(elem);
        clipHeight = projection.clipBounds.bottom - projection.clipBounds.top;
        clipWidth = projection.clipBounds.right - projection.clipBounds.left;

        // If the elements clip area has a height or width of `0`, bail out early.
        if (clipWidth <= 0 || clipHeight <= 0) {
          return;
        }

        transformMatrix = domUtils.getTransformForElement(elem);

        // Apply the transform matrix of the DOM node to the model
        child.rotation.setFromRotationMatrix(transformMatrix);
        child.position.setFromMatrixPosition(transformMatrix);
        child.scale.setFromMatrixScale(transformMatrix);

        // Objects are normalised so we can scale them up by their width to
        // render them at the intended size.
        child.scale.multiplyScalar(scale);

        // Now scale the DOM bounding box so it matches the size and shape of the
        // model. An `IntersectionObserver` will use this DOM structure to decide
        // if this model needs to be rendered at the next animation frame.
        let scaleX = size.x * scale;
        let scaleY = size.y * scale;
        let scaleZ = size.z * scale;
        boundsElem.style.transform = `translate(-50%,-50%)scale3d(${scaleX},${scaleY},${scaleZ})`;

        // Three's coordinate space uses 0,0,0 as the screen centre so we need
        // to adjust the computed X/Y position back to the top-left of the screen
        // to match the CSS rendering position.
        child.position.x -= objWidth - elemWidth / 2;
        child.position.x += objWidth - overlayWidth / 2;
        child.position.y -= elemHeight / 2;
        child.position.y += overlayHeight / 2;

        // Determine which camera to use to project this model and set its
        // properties prior to rendering
        if (projection.perspective) {
          camera = setPerspectiveCamera(
            projection.cameraBounds,
            projection.perspective,
            projection.perspectiveOrigin
          );
        } else {
          camera = setOrthographicCamera(projection.cameraBounds);
        }

        light.position.x = projection.cameraBounds.left + (projection.cameraBounds.right - projection.cameraBounds.left) / 2 - overlayWidth / 2;
        light.position.y = overlayHeight / 2 - projection.cameraBounds.top - (projection.cameraBounds.bottom - projection.cameraBounds.top) / 2;
        light.position.z = camera.far;

        // Set the clipping box (scissor) and render the element.
        renderer.setScissor(
          projection.clipBounds.left,
          overlayHeight - projection.clipBounds.bottom,
          clipWidth,
          clipHeight
        );
        scene.add(child);
        renderer.render(scene, camera);
        scene.remove(child);

      }
    });

    return !!camera;
  };


  const setOrthographicCamera = (bounds) => {
    let camera;

    if (!orthographicCamera) {
      orthographicCamera = new THREE.OrthographicCamera();
    }

    camera = orthographicCamera;
    camera.left = bounds.left - overlayWidth / 2;
    camera.top = -bounds.top + overlayHeight / 2;
    camera.bottom = -bounds.bottom + overlayHeight / 2;
    camera.right = bounds.right - overlayWidth / 2;
    camera.near = -700;
    camera.updateProjectionMatrix();

    return camera;
  };


  const setPerspectiveCamera = (bounds, perspective, perspectiveOrigin) => {
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
    let originX = overlayWidth / 2 - bounds.left - perspectiveOrigin.x;
    let originY = overlayHeight / 2 - bounds.top - perspectiveOrigin.y;


    // The default is origin for perspective is `50% 50%`, which equates to
    // `0,0`. If the author hasn't specified a different value we don't need
    // to make any adjustments to the projection matrix
    if (originX !== 0 || originY !== 0) {

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
    update();
  };


  var modelLayer = {
    init,
    add,
    remove,
    render
  };

  const objects = new WeakMap();


  const ATTR_TO_CUSTOM_PROP_MAP = {
    'width': '--xModelWidth',
    'height': '--xModelHeight'
  };

  const CANVAS_DEFAULT_STYLES =
    ':root{' +
      'transform-style:flat!important;' +
    '}' +
    '#x-model-renderLayer{' +
      'position:fixed;' +
      'top:0;' +
      'left:0;' +
      'pointer-events:none' +
    '}';


  const ELEMENT_DEFAULT_STYLES =
    ':host{' +
      'display:inline-block;' +
      'width:var(--xModelWidth,200px);' +
      'height:var(--xModelHeight,150px);' +
      'transform-style:var(--xModelBoundingBoxTransformStyle, preserve-3d)' +
    '}' +
    '.boundingBox{' +
      'visibility:var(--xModelBoundingBoxVisibility, hidden);' +
      'transform-style:inherit;' +
      'position:relative;' +
      'left:50%;' +
      'top:50%;' +
      'width:1px;' +
      'height:1px;' +
      'background:#08c' +
    '}' +
    '.boundingBox__face{' +
      'position:absolute;' +
      'width:1px;' +
      'height:1px;' +
      'background:#0c0' +
    '}' +
    '.boundingBox__face:nth-child(1){transform:translateZ(-.5px)}' +
    '.boundingBox__face:nth-child(2){transform:translateZ(.5px)}' +
    '.boundingBox__face:nth-child(3){transform:translateY(-.5px)rotateX(90deg)}' +
    '.boundingBox__face:nth-child(4){transform:translateY(.5px)rotateX(-90deg)}' +
    '.boundingBox__face:nth-child(5){transform:translateX(.5px)rotateY(-90deg)}' +
    '.boundingBox__face:nth-child(6){transform:translateX(-.5px)rotateY(-90deg)}';


  const ELEMENT_HTML =
    `<style>${ELEMENT_DEFAULT_STYLES}</style>` +
    '<div class="boundingBox">' +
      '<div class="boundingBox__face"></div>'.repeat(6) +
    '</div>';


  let styleElem;
  let intersectionObserver;


  const intersectionCallback = entries => {
    entries.forEach(entry => {
      let obj = objects.get(entry.target.parentElement);
      if (entry.isIntersecting) {
        if (obj.axisInView < 6) {
          if (obj.axisInView === 0) {
            modelLayer.add(obj);
          }
          obj.axisInView++;
        }
      } else {
        if (obj.axisInView > 0) {
          obj.axisInView--;
          if (obj.axisInView === 0) {
            modelLayer.remove(obj);
          }
        }
      }
    });
  };


  const initModelLayer = () => {
    // The first time an element is added to the document we inject a
    // stylesheet that contains its default styles. Ideally this would be
    // appended to the shadow DOM, but support for that isn't great right now.
    styleElem = domUtils.createStylesheet(CANVAS_DEFAULT_STYLES);
    let head = document.documentElement.firstChild;
    head.insertBefore(styleElem, head.firstChild);

    // Initialize the model layer and append the resulting DOM node to the
    // document root - outside the <body> to prevent perspective or transform
    // styles from affecting it.
    let renderDomElement = modelLayer.init();
    renderDomElement.setAttribute('id', 'x-model-renderLayer');
    document.documentElement.appendChild(renderDomElement);

    // Use an intersection observer to watch for elements entering and leaving
    // the viewport
    intersectionObserver = new IntersectionObserver(intersectionCallback);

  };


  class HTMLModelElement extends HTMLElement {

    constructor() {
      super();
      // Create six child elements. These will be rotated and translated along the
      // X Y and Z axis to create a bounding box around the model. These
      // elements will be monitored by an `IntersectionObserver` which will add
      // the model to the scene if the any elements are visible in the viewport
      // and remove the model when no elements are visible
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = ELEMENT_HTML;
    }

    static get observedAttributes() {
      return ['src', 'width', 'height'];
    }

    connectedCallback() {
      if (!styleElem) {
        initModelLayer();
      }
      let obj = objects.get(this);
      if (obj && obj.elem !== this) {
        let model = obj.children[0];
        let size = model.userData.size;
        let scale = Math.min(this.offsetWidth / size.x, this.offsetHeight / size.y);
        let scaleX = size.x * scale;
        let scaleY = size.y * scale;
        let scaleZ = size.z * scale;

        // Scale and distort the DOM bounding box (a cube) along X, Y and Z axis
        // so it matches the size and shape of the models bounding box.
        let box = this.shadowRoot.querySelector('.boundingBox');
        box.style.transform = `translate(-50%,-50%)scale3d(${scaleX},${scaleY},${scaleZ})`;

        // Monitor each face with an `IntersectionObserver` so we can determine if
        // the model is visible in the viewport when it's rendered with
        // perspective projection.
        let faces = Array.from(box.children);
        faces.forEach(elem => intersectionObserver.observe(elem));

        obj.elem = this;
        obj.axisInView = 0;

        objects.set(box, obj);
      }
    }

    disconnectedCallback() {
      let obj = objects.get(this);
      if (obj && obj.elem === this) {
        let box = this.shadowRoot.querySelector('.boundingBox');
        let faces = Array.from(box.children);
        faces.forEach(elem => intersectionObserver.unobserve(elem));
        obj.elem = null;
      }
    }

    attributeChangedCallback(attribute, oldValue, newValue) {
      if (attribute === 'width' || attribute === 'height') {
        if (newValue !== null) {
          newValue += 'px';
        }
        let customProp = ATTR_TO_CUSTOM_PROP_MAP[attribute];
        this.shadowRoot.children[0].sheet.rules[0].style.setProperty(customProp, newValue);
      } else if (attribute === 'src') {
        // call the disconnected callback handler to release the current model if
        // one is attached
        this.disconnectedCallback();

        modelLoader.load(newValue).then(obj => {
          let event = new UIEvent('load');
          this.dispatchEvent(event);
          objects.set(this, obj);
          this.connectedCallback();
        }).catch(e => {
          let event = new UIEvent('error');
          this.dispatchEvent(event);
        });
      }
    }

  }

  let loader;


  var gltfLoader = src => {

    return new Promise((resolve, reject) => {

      const loadHandler = gltf => {
        resolve(gltf.scene);
      };

      const errorHandler = () => {
        reject();
      };

      if (!loader) {
        loader = new THREE.GLTFLoader();
      }

      return loader.load(src, loadHandler, null, errorHandler);

    });
  };

  let loader$1;


  var objLoader = src => {

    return new Promise((resolve, reject) => {

      const loadHandler = obj => {
        resolve(obj);
      };

      const errorHandler = () => {
        reject();
      };

      if (!loader$1) {
        loader$1 = new THREE.OBJLoader();
      }

      return loader$1.load(src, loadHandler, null, errorHandler);

    });
  };

  if ('customElements' in window) {

    if (!('THREE' in window)) {
      throw 'THREE (threejs.org) is required.';
    }

    if ('GLTFLoader' in THREE) {
      modelLoader.register('.gltf', gltfLoader);
      modelLoader.register('.glb', gltfLoader);
    }

    if ('OBJLoader' in THREE) {
      modelLoader.register('.obj', objLoader);
    }

    customElements.define('x-model', HTMLModelElement);
  }

}());
//# sourceMappingURL=model-element.js.map
