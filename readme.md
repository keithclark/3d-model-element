# 3D model custom element

This is a experimental custom element that allows 3D objects (.obj format) to be loaded into a document and rendered inline, just like any other external resource. Additionally, any CSS transforms applied to a model element will be passed on to the 3D object, allowing complex objects to be placed and maniplulated using just CSS.

![Screengrab of transformed models](https://github.com/keithclark/3d-model-element/blob/master/preview.png?raw=true)

## Examples

* [Hello World](https://keithclark.co.uk/labs/3d-model-custom-element/examples/hello-world/) - A barebones example.
* [Transform tests](https://keithclark.co.uk/labs/3d-model-custom-element/examples/tests/) - A set of rendering test cases.
* [3D Scene](https://keithclark.co.uk/labs/3d-model-custom-element/examples/3d-scene/) - An example of mixing standard HTML elements and models to create a 3D scene.


## Limitations

* Only supports then `.obj` model file format - other loaders will be added in the future.
* At the moment Safari doesn't scroll models because of a bug with `scrollTop`.
* `transform-style: flat` isn't supported yet.


## Getting started

To use this custom element you'll need to include the [three.js](https://threejs.org/) library, its accompanying [OBJ loader](https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/OBJLoader.js) and the [custom element script](https://github.com/keithclark/3d-model-element/blob/master/src/model-element.js):

```html
<script src="js/three.min.js"></script>
<script src="js/three-obj-loader.js"></script>
<script src="js/model-element.js"></script>
```

To bolster up browser support, you can also include a [web components polyfill](https://github.com/WebComponents/webcomponentsjs).

### Using the `<x-model>` element
Adding a model to a page is as simple as adding the element and setting its `src` attribute:

```html
<x-model src="/path/to/my-model.obj"></x-model>
```

Here's a cut-and-paste example:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .model {
      width: 400px;
      height: 400px;
    }
  </style>
</head>

<body>
  <x-model class="model" src="/path/to/my-model.obj"></x-model>

  <script src="js/three.min.js"></script>
  <script src="js/three-obj-loader.js"></script>
  <script src="js/model-element.js"></script>
</body>
</html>
```


### Positioning models

Models can be positioned and rotated using CSS transforms. Any transforms applied to a model element will also be applied to the model.

```css
.model {
  transform: translateZ(-200px) rotateY(45deg);
}
```

### A note on perspective

If you have a `perspective` property value defined in your CSS, the model element will use it to render the object with the correct perspective. Omitting `perspective` (or setting it to zero) will result in objects rendered with orthographic projection.


_Note: It's perfectly valid to nest perspective rules in CSS. However, models will only use the first perspective definition when walking up the DOM tree._


---

## How it works

The model-element script creates a camera, scene, light source and a WebGL renderer. The DOM node returned by the renderer (a `<canvas>` element) is added to the document and configured to fill the viewport and sit above all other content. Additionally, `pointer-events: none` is set, allowing elements below to be interacted with.

Adding `<x-model>` elements to the DOM results in the model being loaded and added to the underling scene. Removing an element from the DOM will remove it from the scene.

The scene is re-rendered every frame. For each object in the scene, the renderer finds it's host node and walks up the DOM treem resolving any transforms, positions and scroll offsets (this is only partially implemented at the moment). The resulting transform matrix is then applied to the object in the scene. Once all objects are updated, the renderer repaints the scene to the layer, in perfect sync with the underlying DOM nodes.


---

# Contributing

## Requirements

* Node / NPM


## Setup

1) Clone this repo.
2) Install dependencies: `npm install`
3) Build the project with the watch task: `npm start dev`
4) Start editing...


## Other build options

* `npm start dist` - builds the both the unminified and minified distribution files to the `/dist/` folder.
