import modelLoader from './modelLoader';
import modelLayer from './modelLayer';
import domUtils from './utils/dom';


const objects = new WeakMap();


const ATTR_TO_CUSTOM_PROP_MAP = {
  'width': '--xModelWidth',
  'height': '--xModelHeight'
}

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


export default class extends HTMLElement {

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
