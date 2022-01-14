import {
    mat4,
    vec3
  } from "gl-matrix";
  
  import {
    cameraProject,
    createOrthoFromView,
    createPerspectiveFromView
  } from "./mat4-camera.js";
  
  export default function createCamera(props = {}) {
    const {
      fov = 50,
      x = 0,
      y = 0,
      target = [0, 0, 0],
      up = [0, 1, 0],
      mode = "perspective",
      width = 1,
      height = 1
    } = props;
  
    let zoom = props.zoom != null ? props.zoom : 1;
    let position = props.position || [1, 1, 1];
    const ortho = mode !== "perspective";
    const defaultNear = ortho ? -100 : 0.01;
    const defaultFar = ortho ? 100 : 1000;
    const near = props.near != null ? props.near : defaultNear;
    const far = props.far != null ? props.far : defaultFar;
    const filmGauge = props.filmGauge != null ? props.filmGauge : 35;
    const filmOffset = props.filmOffset != null ? props.filmOffset : 0;
  
    const size = 2;
    const aspect = width / height;
    const H = size * aspect;
    const V = size;
  
    const left = props.left != null ? props.left : -1;
    const right = props.right != null ? props.right : 1;
    const bottom = props.bottom != null ? props.bottom : -1;
    const top = props.top != null ? props.top : 1;
  
    let projection;
    if (mode === "isometric") {
      const posLen = vec3.length(position);
      position = vec3.scale([], position, posLen !== 0 ? 1 / posLen : 1);
      zoom /= posLen / 2;
      projection = createOrthoFromView([], -H, H, -V, V, zoom, near, far);
    } else if (mode === "perspective") {
      projection = createPerspectiveFromView(
        [],
        fov,
        aspect,
        near,
        far,
        zoom,
        filmGauge,
        filmOffset
      );
    } else {
      projection = createOrthoFromView(
        [],
        left,
        right,
        bottom,
        top,
        zoom,
        near,
        far
      );
    }
  
    const targetMatrix = mat4.targetTo([], position, target, up);
    const cameraMatrix = mat4.fromTranslation([], position);
    mat4.multiply(cameraMatrix, cameraMatrix, targetMatrix);
  
    const view = mat4.invert([], cameraMatrix);
    const combinedProjView = mat4.multiply([], projection, view);
    const viewport = [x, y, width, height];
  
    return (p) => {
      const [x, y, w, h] = viewport;
      const pos = cameraProject([], p, viewport, combinedProjView);
      pos[1] = h - pos[1]; // invert Y coord
      return pos;
    };
  }
  