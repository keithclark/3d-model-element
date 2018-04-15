/**
 * Strips the unit from a value (i.e. 100.55px) and converts the remaining
 * value to a number.
 */
const parseUnitValue = value => {
  return parseFloat(value || 0);
};


/**
 * Parses a CSS origin string (`perspective-origin`, `transform-origin`) into
 * it's X, Y and Z components and populates the supplied THREE.Vector3 with
 * the result.
 */
const parseOriginValue = (originString, vec3) => {
  let transformOrigin = originString.split(' ');
  vec3.set(
    parseUnitValue(transformOrigin[0]),
    parseUnitValue(transformOrigin[1]),
    parseUnitValue(transformOrigin[2])
  );
};


/**
 * Parses a CSS 3x2 matrix() or 4x4 matrix3d() string into its compontents and 
 * populates the passed THREE.Matrix4 with the result.
 * 
 * (https://keithclark.co.uk/articles/calculating-element-vertex-data-from-css-transforms/)
 */

const parseTransformValue = (matrixString, mat4) => {
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
      -c[1], +c[5],  -c[9], -c[13],
      +c[2], -c[6], +c[10], +c[14],
      +c[3], +c[7], +c[11], +c[15]
    );
  } else {
    // handle 'none' or invalid values.
    mat4.identity();
  }
};


export default {
  parseTransformValue,
  parseOriginValue,
  parseUnitValue
};
