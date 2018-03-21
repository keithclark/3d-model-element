import domUtils from './utils/dom';

let perspective;
let camera;
let overlayWidth;
let overlayHeight;
let perspectiveCamera;
let orthographicCamera
let renderer;
let scene;
let light;


const init = () => {
  if (scene) {
    return false;
  }

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

  requestAnimationFrame(render);

  return renderer.domElement;
}


const add = obj => {
  scene.add(obj);
}


const remove = (obj) => {
  scene.remove(obj);
}


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
      // render them at the intended size. Scaling by a factor of `0` causes
      // problems with inverting matrix because the determinant will be 0 so
      // we use a default of `1`.
      child.scale.multiplyScalar(width || 1);

      // Three's coordinate space uses 0,0,0 as the screen centre so we need
      // to adjust the computed X/Y position back to the top-left of the
      // screen to match the CSS rendering position.
      child.position.x += width - overlayWidth / 2;;
      child.position.y += overlayHeight / 2;
    }

    // TODO: determine if this object is visible the viewport and set the
    // `needsRender` flag accordingly
    if (!needsRender) {
      needsRender = true;
    }
  });

  return camera && needsRender;
}


const setOrthographicCamera = () => {
  let camera;
  
  if (!orthographicCamera) {
    orthographicCamera = new THREE.OrthographicCamera();
  } 
  
  camera = orthographicCamera;
  camera.left = -overlayWidth / 2;;
  camera.right = overlayWidth / 2;;
  camera.top = overlayHeight / 2;
  camera.bottom = -overlayHeight / 2;
  camera.far = 2000;
  camera.near = -700;
  camera.updateProjectionMatrix();

  return camera;
}


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
}


const render = () => {
  requestAnimationFrame(render);

  if (update()) {
    renderer.setSize(overlayWidth, overlayHeight);
    renderer.render(scene, camera);
  };
}


export default {
  init,
  add,
  remove,
  render
}
