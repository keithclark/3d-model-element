/**
 * x-model custom element by Keith Clark
 * 
 * <x-model> is a custom element for loading and rendering 3D models inline in a
 * HTML document.
 */

(() => {

  const RENDER_OBJECT_BOUNDING_BOX = false;


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
        child.position.x += width - overlayWidth / 2;
        child.position.y += overlayHeight / 2;
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
        camera.left = overlayWidth / -2;
        camera.right = overlayWidth / 2;
        camera.top = overlayHeight / 2;
        camera.bottom = overlayHeight / -2;
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
    let transformMatrix = new THREE.Matrix4();
    let transformOrigin = new THREE.Vector3();
    let transformOriginMatrix = new THREE.Matrix4();
    let targetElem = elem;
    let osParent = elem;
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

    posX -= targetElem.offsetWidth / 2;
    posY += targetElem.offsetHeight / 2;

    m1.makeTranslation(posX, -posY, 0);

    // Now we can resolve transforms.
    while (elem = stack.pop()) {

      let style = getComputedStyle(elem);

      // TODO: It's possible to nest perspectives. Need to research the impact
      // of this and, if possible, how to emulate it. For now, we'll just use
      // the last value found.
      let perspectiveValue = style.perspective;
      if (perspectiveValue !== 'none') {
        perspective = parseCssUnitValue(perspectiveValue);
      }

      parseCssOriginValue(style.transformOrigin, transformOrigin);
      parseCssTransformValue(style.transform, transformMatrix);

      let ox = transformOrigin.x - elem.offsetWidth / 2;
      let oy = transformOrigin.y - elem.offsetHeight / 2;
      let oz = transformOrigin.z;

      m1.multiply(transformOriginMatrix.makeTranslation(ox, -oy, oz));
      m1.multiply(transformMatrix);
      m1.multiply(transformOriginMatrix.makeTranslation(-ox, oy, -oz));
    }

    return {
      matrix: m1,
      perspective: perspective
    };
  }


  /**
   * Strips the unit from a value (i.e. 100.55px) and converts the remaining
   * value to a number.
   */
  const parseCssUnitValue = value => {
    return parseFloat(value || 0);
  }


  /**
   * Parses a CSS origin string (`perspective-origin`, `transform-origin`) into
   * it's X, Y and Z components and populates the supplied THREE.Vector3 with
   * the result.
   */
  const parseCssOriginValue = (originString, vec3) => {
    let transformOrigin = originString.split(' ');
    vec3.set(
      parseCssUnitValue(transformOrigin[0]),
      parseCssUnitValue(transformOrigin[1]),
      parseCssUnitValue(transformOrigin[2])
    );
  }


  /**
   * Parses a CSS 3x3 or 4x4 matrix string into its compontents and populates 
   * the passed THREE.Matrix4 with the result.
   * 
   * (https://keithclark.co.uk/articles/calculating-element-vertex-data-from-css-transforms/)
   */

  const parseCssTransformValue = (matrixString, mat4) => {
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
        -c[1], +c[5],  -c[9], +c[13],
        +c[2], -c[6], +c[10], +c[14],
        +c[3], +c[7], +c[11], +c[15]
      );
    } else {
      // handle 'none' or invalid values.
      mat4.identity();
    }
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

          if (RENDER_OBJECT_BOUNDING_BOX) {
            let material = new THREE.LineBasicMaterial({color: 0x00ff00});
            let geometry = new THREE.PlaneGeometry(size.x, size.y);
            let wireframe = new THREE.WireframeGeometry(geometry);
            let line = new THREE.LineSegments(wireframe, material);
            line.scale.set(scale, scale, scale);
            pivot.add(line);
          }

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
