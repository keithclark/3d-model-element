import modelLoader from './modelLoader';
import modelLayer from './modelLayer';


export default class extends HTMLElement {

  constructor() {
    super();
  }

  static get observedAttributes() {
    return ['src'];
  }

  connectedCallback() {

  }

  disconnectedCallback() {
  }

  attributeChangedCallback(attribute, oldValue, newValue) {
    if (attribute === 'src') {
      modelLoader.load(newValue).then(obj => {
        obj.elem = this;
        modelLayer.add(obj);
      });
    }
  }

}
