import modelLoader from './modelLoader';
import modelLayer from './modelLayer';


const objects = new WeakMap();


export default class extends HTMLElement {

  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['src'];
  }

  connectedCallback() {
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
        objects.set(this, obj);
        this.connectedCallback();
      });
    }
  }

}
