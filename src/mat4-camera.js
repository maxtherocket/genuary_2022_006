// Camera projection utilities
import { mat4 } from "gl-matrix";

var NEAR_RANGE = 0;
var FAR_RANGE = 1;
var tmp4 = [0, 0, 0, 0];

const vec4TransformMat4 = (out, a, m) => {
  var [x, y, z, w] = a;
  return setn(
    out,
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w
  );
};

const setn = (out, ...args) => {
  for (let i = 0; i < args.length; i++) out[i] = args[i];
  return out;
};

export function cameraProject(out, vec, viewport, combinedProjView) {
  var vX = viewport[0],
    vY = viewport[1],
    vWidth = viewport[2],
    vHeight = viewport[3],
    n = NEAR_RANGE,
    f = FAR_RANGE;

  // convert: clip space -> NDC -> window coords
  // implicit 1.0 for w component
  setn(tmp4, vec[0], vec[1], vec[2], 1.0);

  // transform into clip space
  vec4TransformMat4(tmp4, tmp4, combinedProjView);

  // now transform into NDC
  var w = tmp4[3];
  if (w !== 0) {
    // how to handle infinity here?
    tmp4[0] = tmp4[0] / w;
    tmp4[1] = tmp4[1] / w;
    tmp4[2] = tmp4[2] / w;
  }

  // and finally into window coordinates
  // the foruth component is (1/clip.w)
  // which is the same as gl_FragCoord.w
  out[0] = vX + (vWidth / 2) * tmp4[0] + (0 + vWidth / 2);
  out[1] = vY + (vHeight / 2) * tmp4[1] + (0 + vHeight / 2);
  out[2] = ((f - n) / 2) * tmp4[2] + (f + n) / 2;
  out[3] = w === 0 ? 0 : 1 / w;
  return out;
}

export function createOrthoFromView(
  out,
  left,
  right,
  bottom,
  top,
  zoom,
  near,
  far
) {
  const dx = (right - left) / (2 * zoom);
  const dy = (top - bottom) / (2 * zoom);
  const cx = (right + left) / 2;
  const cy = (top + bottom) / 2;

  let L = cx - dx;
  let R = cx + dx;
  let T = cy + dy;
  let B = cy - dy;
  return mat4.ortho(out, L, R, B, T, near, far);
}

export function createPerspectiveFromView(
  out,
  fov,
  aspect,
  near,
  far,
  zoom = 1,
  filmGauge = 35,
  filmOffset = 0
) {
  const radFov = (0.5 * fov * Math.PI) / 180;
  let top = (near * Math.tan(radFov)) / zoom;
  let height = 2 * top;
  let width = aspect * height;
  let left = -0.5 * width;
  const skew = filmOffset;
  const filmWidth = filmGauge * Math.min(aspect, 1);
  if (skew !== 0) left += (near * skew) / filmWidth;
  return perspective(out, left, left + width, top - height, top, near, far);
}

export function perspective(out, left, right, bottom, top, near, far) {
  if (!out) out = new Array(16).fill(0);

  const x = (2 * near) / (right - left);
  const y = (2 * near) / (top - bottom);

  const a = (right + left) / (right - left);
  const b = (top + bottom) / (top - bottom);
  const c = -(far + near) / (far - near);
  const d = (-2 * far * near) / (far - near);
  out[0] = x;
  out[4] = 0;
  out[8] = a;
  out[12] = 0;
  out[1] = 0;
  out[5] = y;
  out[9] = b;
  out[13] = 0;
  out[2] = 0;
  out[6] = 0;
  out[10] = c;
  out[14] = d;
  out[3] = 0;
  out[7] = 0;
  out[11] = -1;
  out[15] = 0;
  return out;
}
