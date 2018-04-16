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
    'display:inline-block;' +
    'width:250px;' +
    'height:250px' +
  '}';

let styleElem;


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
};


export default class extends HTMLElement {

  constructor() {
    super();
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
      modelLayer.add(obj);
    }
  }

  disconnectedCallback() {
    let obj = objects.get(this);
    if (obj && obj.elem === this) {
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
        objects.set(this, obj);
        this.connectedCallback();
      }).catch(e => {
        let event = new UIEvent('error');
        this.dispatchEvent(event);
      });
    }
  }

}
