import modelLoader from './modelLoader';
import modelLayer from './modelLayer';
import domUtils from './utils/dom';


const objects = new WeakMap();

const ELEMENT_DEFAULT_STYLES =
  '#x-model-renderLayer{' +
    'position:fixed;' +
    'top:0;' +
    'left:0;' +
    'pointer-events:none' +
  '}' +
  'x-model{' +
    'position:relative;'+
    'display:inline-block;' +
    'width:250px;' +
    'height:250px' +
  '}' +
  'x-model>div{' +
    'position:absolute;top:0;left:0;visibility:hidden;' +
    'width:100%;' +
    'height:100%;' +
    'border:2px solid red;' +
    'transform: translateX(-50%) rotateY(-90deg);' +
  '}' +
  'x-model>div:last-child{' +
    'right:0;left:auto;' +
    'transform: translateX(50%) rotateY(-90deg);' +
  '}';

let styleElem;
let intesectionObserver;


const intersectionCallback = entries => {
  entries.forEach(entry => {
    let obj = objects.get(entry.target);
    if (entry.isIntersecting) {
      if (obj.axisInView<2) {
        obj.axisInView++;
      }
    } else {
      if (obj.axisInView>0) {
        obj.axisInView--;
      }
    }
  });
};


const initModelLayer = () => {
  // The first time an element is added to the document we inject a
  // stylesheet that contains its default styles. Ideally this would be
  // appended to the shadow DOM, but support for that isn't great right now.
  styleElem = domUtils.createStylesheet(ELEMENT_DEFAULT_STYLES);
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
  intesectionObserver = new IntersectionObserver(intersectionCallback);

};


export default class extends HTMLElement {

  constructor() {
    super();
    // Create two child elements. These will be rotated 90 degrees around the Y
    // axis and moved left and right to create a bounding box around the model.
    // Doing this ensures that all 8 croners of the models bounding box are
    // accounted for when using the intersection observer.
    this.innerHTML = '<div></div><div></div>';
  }

  static get observedAttributes() {
    return ['src'];
  }

  connectedCallback() {
    if (!styleElem) {
      initModelLayer();
    }

    let obj = objects.get(this);
    if (obj && obj.elem !== this) {
      obj.elem = this;
      intesectionObserver.observe(this.firstElementChild);
      intesectionObserver.observe(this.lastElementChild);
      objects.set(this.firstElementChild, obj);
      objects.set(this.lastElementChild, obj);
      modelLayer.add(obj);

    }
  }

  disconnectedCallback() {
    let obj = objects.get(this);
    if (obj && obj.elem === this) {
      intesectionObserver.unobserve(this.firstElementChild);
      intesectionObserver.unobserve(this.lastElementChild);
      modelLayer.remove(obj);
      obj.elem = null;
    }
  }

  attributeChangedCallback(attribute, oldValue, newValue) {
    if (attribute === 'src') {

      // call the disconnected callback handler to release the current model if
      // one is attached
      this.disconnectedCallback();

      modelLoader.load(newValue).then(obj => {
        let event = new UIEvent('load');
        this.dispatchEvent(event);
        obj.axisInView = 0;
        objects.set(this, obj);
        this.connectedCallback();
      }).catch(e => {
        let event = new UIEvent('error');
        this.dispatchEvent(event);
      });
    }
  }

}
