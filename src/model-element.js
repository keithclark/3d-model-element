/**
 * x-model custom element by Keith Clark
 * 
 * <x-model> is a custom element for loading and rendering 3D models inline in a
 * HTML document.
 */

(() => {

  // If this browser doesn't support custom elements bail out now
  if (!('customElements' in window)) {
    return;
  }

  // create the cameras
  const perspectiveCamera = new THREE.PerspectiveCamera();
  const orthographicCamera = new THREE.OrthographicCamera();

  // create the WebGL renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  // create the scene
  const scene = new THREE.Scene();

  // add a light
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(0, 0, 1);
  scene.add(light);
  
  // create the custom element stylesheet
  let css = document.createElement('style');
  css.textContent = ':host {display:inline-block; width:400px; height:400px;}';


  /**
   * The renderer.
   */

  const render = () => {
    requestAnimationFrame(render);

    let perspective;
    let camera;
    let overlayWidth = window.innerWidth;
    let overlayHeight = window.innerHeight;
    let needsRender = false;

    // Walk over each object and update it
    scene.children.forEach(child => {
      let elem = child.elem;
      if (elem) {

        let width = elem.offsetWidth;
        
        let transform = getTransformForElement(elem);

        // If we haven't yet figured out which type of camera to use for
        // projecting the scene, do it now. If the current element doesn't have
        // a parent with a `perspective`, we use orthographic projection.
        if (!camera) {
          if (transform.perspective) {
            camera = perspectiveCamera;
            perspective = transform.perspective;
          } else {
            camera = orthographicCamera;
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
        child.position.x += width - ((overlayWidth / 2) )
        child.position.y += (overlayHeight / 2)
      }

      // TODO: determine if this object is visible the viewport and set the
      // `needsRender` flag accordingly
      if (!needsRender) {
        needsRender = true;
      }
    });

    // If we have a camera and the scene needs to be re-rendered then we need to
    // set the camera properties and fire up the renderer...
    if (camera && needsRender) {
      if (camera.isPerspectiveCamera) {
        camera.fov = 180 * (2 * Math.atan(overlayHeight / 2 / perspective)) / Math.PI;
        camera.aspect = overlayWidth / overlayHeight;
        camera.position.set(0, 0, perspective);
      } else {
        camera.left = overlayWidth / - 2;
        camera.right = overlayWidth / 2;
        camera.top = overlayHeight / 2;
        camera.bottom = overlayHeight / - 2;
        camera.far = 15000;
        camera.near = -700;
      }

      camera.updateProjectionMatrix();

      // render the scene
      renderer.setSize(overlayWidth, overlayHeight);
      renderer.render(scene, camera);
    }
  }

  /**
   * Resolves and returns the transform and perspective properties for a given
   * element. 
   */

  const getTransformForElement = elem => {
    let a = new THREE.Vector3()
    let b = new THREE.Quaternion()
    let c = new THREE.Vector3()
    let m1 = new THREE.Matrix4();
    let m2 = new THREE.Matrix4();
    let targetElem = osParent = elem;
    let stack = [];
    let posX = 0, posY = 0;
    let perspective = 0;

    // if this element doesn't have a width or height bail out now.
    if (elem.offsetWidth === 0 || elem.offsetHeight === 0) {
      return {
        matrix: m1
      };
    }

    // We need to apply transforms from the root so we walk up the DOM tree,
    // pushing each node onto a stack. While we're walking to the DOM we also
    // resolve the elements X/Y position.
    while (elem) {
      if (elem === osParent) {
        posX += elem.offsetLeft;
        posY += elem.offsetTop;
        osParent = elem.offsetParent;
      }
      posX -= elem.scrollLeft;
      posY -= elem.scrollTop;
      stack.push(elem);
      elem = elem.parentElement;
    }

    // Now we can resolve transforms.
    while (elem = stack.pop()) {

      let style = getComputedStyle(elem);

      // TODO: It's possible to nest perspectives. Need to research the impact
      // of this and, if possible, how to emulate it. For now, we'll just use
      // the last value found.
      let perspectiveValue = style.perspective;
      if (perspectiveValue !== 'none') {
        perspective = parseFloat(perspectiveValue);
      }

      let cssMatrix = parseCssTransformMatrix(style.transform);
      m2.set(
        cssMatrix.m11, cssMatrix.m12, cssMatrix.m13, cssMatrix.m14,
        cssMatrix.m21, cssMatrix.m22, cssMatrix.m23, cssMatrix.m24,
        cssMatrix.m31, cssMatrix.m32, cssMatrix.m33, cssMatrix.m34,
        cssMatrix.m41, cssMatrix.m42, cssMatrix.m43, cssMatrix.m44
      );

      // The sign of the Y rotation needs to be flipped. At the time of writing,
      // I could only acheive this by decomposing the matrix, flipping the
      // rotation sign and re-composing it.
      m2.decompose(a, b, c);
      b.y *= -1;
      a.x += cssMatrix.m41;
      a.y -= cssMatrix.m42;
      a.z += cssMatrix.m43;
      m2.compose(a, b, c);

      // apply the matrix
      m1.multiply(m2);
    }


    m1.elements[12] += posX - targetElem.offsetWidth / 2;
    m1.elements[13] -= posY + targetElem.offsetHeight / 2;

    return {
      matrix: m1,
      perspective: perspective
    };
  }


  const epsilon = value => {
    return Math.abs(value) < Number.EPSILON ? 0 : value;
  }


  const getObjectCSSMatrix = matrix => {
    var elements = matrix.elements;
    return 'matrix3d(' +
      epsilon(elements[0]) + ',' +
      epsilon(elements[4]) + ',' +
      epsilon(elements[8]) + ',' +
      epsilon(elements[12]) + ',' +
      epsilon(elements[1]) + ',' +
      epsilon(elements[5]) + ',' +
      epsilon(elements[9]) + ',' +
      epsilon(elements[13]) + ',' +
      epsilon(elements[2]) + ',' +
      epsilon(elements[6]) + ',' +
      epsilon(elements[10]) + ',' +
      epsilon(elements[14]) + ',' +
      epsilon(elements[3]) + ',' +
      epsilon(elements[7]) + ',' +
      epsilon(elements[11]) + ',' +
      epsilon(elements[15]) +
    ')';
  }


  /**
   * Parses a matrix string and returns a 4x4 matrix
   * 
   * (https://keithclark.co.uk/articles/calculating-element-vertex-data-from-css-transforms/)
   */

  const parseCssTransformMatrix = matrixString => {
    var c = (matrixString||'').split(/\s*[(),]\s*/).slice(1,-1),
        matrix;

    if (c.length === 6) {
        // 'matrix()' (3x2)
        matrix = {
            m11: +c[0], m21: +c[2], m31: 0, m41: +c[4],
            m12: +c[1], m22: +c[3], m32: 0, m42: +c[5],
            m13: 0,     m23: 0,     m33: 1, m43: 0,
            m14: 0,     m24: 0,     m34: 0, m44: 1
        };
    } else if (c.length === 16) {
        // matrix3d() (4x4)
        matrix = {
            m11: +c[0], m21: +c[4], m31: +c[8], m41: +c[12],
            m12: +c[1], m22: +c[5], m32: +c[9], m42: +c[13],
            m13: +c[2], m23: +c[6], m33: +c[10], m43: +c[14],
            m14: +c[3], m24: +c[7], m34: +c[11], m44: +c[15]
        };

    } else {
        // handle 'none' or invalid values.
        matrix = {
            m11: 1, m21: 0, m31: 0, m41: 0,
            m12: 0, m22: 1, m32: 0, m42: 0,
            m13: 0, m23: 0, m33: 1, m43: 0,
            m14: 0, m24: 0, m34: 0, m44: 1
        };
    }
    return matrix;
  };


  /**
   * Model loader
   * 
   * This returns a promise that will resolve with a copy of the imported model.
   */

  const objects = [];

  const loadModel = src => {
    let promise = objects[src];
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        new THREE.OBJLoader().load(src, object => {
          resolve(object);
        });
      });
      objects[src] = promise;
    }
    return promise.then(model => model.clone());
  }


  /**
   * <x-model> HTML element
   */

  class ModelElement extends HTMLElement {
    
    constructor() {

      super();

      if (this.attachShadow) {
        let shadowRoot = this.attachShadow({
          mode: 'open'
        });
        shadowRoot.appendChild(css.cloneNode(true));
      }
    }

    static get observedAttributes() {
      return ['src'];
    }

    connectedCallback() {
    }

    disconnectedCallback() {
      let i = scene.children.find(obj => obj.elem === this);
      if (i) {
        scene.remove(i);
      }
    }

    attributeChangedCallback(attribute, oldValue, newValue ) {
      var scope = this;

      if (attribute === 'src') {
        loadModel(newValue).then(obj => {
          let box = new THREE.Box3().setFromObject(obj);
          let pivot = new THREE.Object3D();
          let size = new THREE.Vector3();
          box.getCenter(obj.position);
          box.getSize(size);

          let scale = 1 / Math.max(size.x, size.y);
          obj.position.multiplyScalar(-scale);
          obj.scale.set(scale, scale, scale);
          pivot.add(obj);

          // TODO: refactor (see: disconnectedCallback)
          let i = scene.children.find(obj => obj.elem === this);
          if (i) {
            scene.remove(i);
          }

          scene.add(pivot);
          pivot.elem = this;
        });
      }
    }
  }

  customElements.define('x-model', ModelElement);

  renderer.domElement.style.cssText = 'pointer-events:none;position:fixed;top:0;left:0;';
  document.documentElement.appendChild(renderer.domElement);

  render();

})();
