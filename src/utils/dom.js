import cssUtils from './css';

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



export default {
  getTransformForElement,
  getProjectionForElement,
  createStylesheet
};
