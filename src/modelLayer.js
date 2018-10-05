import domUtils from './utils/dom';

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


export default {
  init,
  add,
  remove,
  render
};
