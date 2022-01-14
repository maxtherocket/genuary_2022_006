const canvasSketch = require('canvas-sketch');
const createCamera = require('./src/createCamera').default;
const { clipPolylinesToBox } = require('canvas-sketch-util/geometry');
const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const Poison = require('poisson-disk-sampling');
const colors = require('nice-color-palettes');
const Curve = require('./src/Curve');
const Vector = require('./src/Vector');
const Tweakpane = require('tweakpane');

const Vec = (x, y) => new Vector(x, y);

// You can force a specific seed by replacing this with a string value
const defaultSeed = '';
// 79142
// 251570
// 68001
// 989191
// 940838

const defaultColor = '';
// Color themes
// 95
// 39

// Set a random seed so we can reproduce this print later
Random.setSeed(defaultSeed || Random.getRandomSeed());

const colorThemeIndex = defaultColor || Random.rangeFloor(colors.length);
console.log('Color Theme Index:', colorThemeIndex);

const colorTheme = colors[colorThemeIndex].map((c)=>{
  return Color.parse(c);
});
const colorThemeNoBg = colorTheme.slice(1, colorTheme.length);

const settings = {
  dimensions: [ 2048, 2048 ],
  animate: false
};

const generateGridPoints = (width, height, numX, numY) => {
  const points = [];
  const stepX = width / (numX - 1);
  const stepY = height / (numY - 1);
  for (let x = 0; x < numX; x++) {
    for (let y = 0; y < numY; y++) {
      const point = [x * stepX, y * stepY];
      points.push(point);
    }
  }
  return points;
}

function getFieldAngle(x, y) {
  return Random.noise2D(x, y, 0.2) * Math.PI * 0.5
}

function fieldCurve(x, y, stepLength, numSteps) {
  let p = Vec(x, y);
  let q = Vec(x, y);
  let n = numSteps >> 1;
  let curve = new Curve(p);
  while (--n > 0) {
    let angle = getFieldAngle(p.x, p.y);
    let v = Vec(1, 0).rotate(angle).scale(stepLength);
    p = p.add(v);
    curve.push(p);
  }
  curve = curve.reverse();
  n = numSteps - (numSteps >> 1);
  while (--n > 0) {
    let angle = getFieldAngle(q.x, q.y);
    let v = Vec(-1, 0).rotate(angle).scale(stepLength);
    q = q.add(v);
    curve.push(q);
  }
  return curve;
}

function drawCurve(ctx, curve) {
  ctx.beginPath();
  curve.map((v, i) => {
    ctx.lineTo(v.x, v.y);
  });
  ctx.stroke();
}

function generateCurveVertices(curve) {
  return curve.map((c) => {
    const y = (Random.noise2D(c.x, c.y, 0.2) + 1) * 0.5;
    return [c.x, y, c.y];
  });
}

function removePointsOutsideBox(x, y, size, points) {
  const halfSize = size / 2;
  const left = -halfSize;
  const right = halfSize;
  const top = -halfSize;
  const bottom = halfSize;
  return points.filter((p) => {
    return !((p.x < left || p.x > right) || (p.y < top || p.y > bottom));
  });
}

let sketchManager;

// Here is our 'sketch' function that wraps the artwork
function sketch(props) {

  const { context, width, height, time } = props;

  const controls = {
    poisonMin: 0.05,
    poisonMax: 0.08
  };
  const camControls = {
    xAngle: 0,
    yAngle: 0,
    xPos: 3,
    yPos: 2.5,
    zPos: -3
  };

  const pane = new Tweakpane.Pane();
  const paneControls = pane.addFolder({title: 'Controls'});
  paneControls.addInput(controls, 'poisonMin', {
    min: 0, max: 100
  });
  paneControls.addInput(controls, 'poisonMax', {
    min: 0, max: 100
  });
  const renderButton = paneControls.addButton({title: 'Render'})
  renderButton.on('click', (e) => {
    if (sketchManager) {
      sketchManager.render();
    }
  });
  const cameraControls = pane.addFolder({title: 'Camera'});
  paneControls.addInput(camControls, 'xAngle', {
    min: -Math.PI, max: Math.PI, step: 0.1
  }); 
  paneControls.addInput(camControls, 'yAngle', {
    min: -Math.PI, max: Math.PI, step: 0.1
  });
  paneControls.addInput(camControls, 'xPos', {
    min: -10, max: 10, step: 0.5
  }); 
  paneControls.addInput(camControls, 'yPos', {
    min: -10, max: 10, step: 0.5
  }); 
  paneControls.addInput(camControls, 'zPos', {
    min: -10, max: 10, step: 0.5
  }); 

  const fieldSize = 6;
  var p = new Poison({
    shape: [fieldSize, fieldSize],
    minDistance: controls.poisonMin,
    maxDistance: controls.poinsonMax,
    tries: 10
  });
  const densitiy = 10;
  var points = p.fill().map((p) => {
    p[0] -= fieldSize/2; 
    p[1] -= fieldSize/2;
    return p;
  });

  const curveSettings = points.map((point) => {
    return {
      point,
      stepLen: Math.abs(Random.gaussian()) * 0.01,
      stepsNum: Math.max(1, Math.abs(Random.gaussian()) * 10),
      lineWidth: Math.abs(Random.gaussian()) * 5
    }
  });

  const curves = curveSettings.map((c) => {
    // draw the arc
    const x = c.point[0];
    const y = c.point[1];
    const curve = fieldCurve(x, y, c.stepLen, c.stepsNum);
    cleanedCurve = removePointsOutsideBox(0,0, fieldSize, curve);
    return {
      cleanedCurve,
      settings: c,
      vertices: generateCurveVertices(curve)
    };
  });

  // Return a 'render' function that determines how to show the artwork
  return ({ context, width, height, time }) => {
    // Clear buffer
    context.clearRect(0, 0, width, height);

    // Draw background
    const bgColor = colorTheme[0].hex;
    context.fillStyle = bgColor;
    context.fillRect(0, 0, width, height);
    context.lineWidth = 2;

    // Set fill/stroke color
    context.fillStyle = context.strokeStyle = "black";

    // Min dimension of screen
    const dim = Math.min(width, height);

    // Determine the new position of our camera in 3D space
    // It will orbit around in a circle and also span up and down on Y axis
    const curTime = time + 2.5;
    const orbitAngle = curTime * 0.5;
    const orbitDistance = 5;
    const u = Math.cos(camControls.xAngle) * orbitDistance;
    const v = Math.sin(camControls.yAngle) * orbitDistance;
    const y = Math.sin(curTime) * orbitDistance * 2;
    const position = [camControls.xPos, camControls.yPos, camControls.zPos];

    // Setup a camera projection function
    const project = createCamera({
      // You can also try using different projection methods
      mode: "isometric",
      position,
      width,
      height
    });

    // Our 3D vertex data, a 2D square
    const halfSize = fieldSize / 2;
    const floorPlanes = [];
    let lastY = -0.01;
    for (let i = 0; i < 5; i++) {
      const y = (i == 0) ? lastY : lastY + Math.abs(Random.gaussian()) * -0.1;
      const vertices = [
        [-halfSize, y, -halfSize],
        [halfSize, y, -halfSize],
        [halfSize, y, halfSize],
        [-halfSize, y, halfSize]
      ];
      floorPlanes.push(vertices);
      lastY = y;
    }
    context.fillStyle = bgColor;
    floorPlanes.reverse().map((vertices) => {
      // Project 3D points to 2D screen-space positions
      const points2D = vertices.map((v) => project(v));
      context.strokeStyle = Random.pick(colorThemeNoBg).hex;
      context.beginPath();
      points2D.forEach((p) => {
        const [x, y] = p;
        context.lineTo(x, y);
      });
      context.closePath();
      context.fill();
      context.stroke();
    });


    curves.map((c) => {
      c.points2D = c.vertices.map((v) => project(v));
    });

    context.strokeStyle = Random.pick(colorThemeNoBg).hex;
    // Connect points to form a 3D square
    curves.map((c) => {
      const points2D = c.points2D
      context.beginPath();
      points2D.forEach((p) => {
        const [x, y] = p;
        context.lineTo(x, y);
      });
      context.closePath();
      context.stroke();
    });
  };
}

canvasSketch(sketch, settings).then((manager) => {
  sketchManager = manager;
});
