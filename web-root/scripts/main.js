/* global satSet */
/* global $ */
/* global shaderLoader */
/* global Line */
/* global vec4 */
/* global mat4 */
/* global vec3 */
/* global mat3 */
/* global earth */
/* global searchBox */
/* global Spinner */
/* global sun */
/* global orbitDisplay */
var gl;
var cubeVertIndexBuffer;

var R2D = 180 / Math.PI;

var camYaw = 0;
var camPitch = 0;

var camYawTarget = 0;
var camPitchTarget = 0;
var camSnapMode = false;

var camDistTarget = 10000;
var zoomLevel = 0.3;
var zoomTarget = 0.3;
var ZOOM_EXP = 3;
var DIST_MIN = 6400;
var DIST_MAX = 200000;

var camPitchSpeed = 0;
var camYawSpeed = 0;

var pickFb, pickTex;
var pickColorBuf;

var pMatrix = mat4.create(), camMatrix = mat4.create();

var selectedSat = -1;

var mouseX = 0, mouseY = 0, mouseSat = -1;
var isDragging = false;
var dragPoint = [0,0,0];
var dragStartPitch = 0;
var dragStartYaw = 0;

var debugContext, debugImageData;

var debugLine, debugLine2, debugLine3;
var spinner;
$(document).ready(function() {
  var opts = {
    lines: 11, // The number of lines to draw
    length: 8, // The length of each line
    width: 5, // The line thickness
    radius: 8, // The radius of the inner circle
    corners: 1, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#fff', // #rgb or #rrggbb or array of colors
    speed: 1, // Rounds per second
    trail: 50, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: false, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
  };
  var target = document.getElementById('spinner');
  spinner = new Spinner(opts).spin(target);
  
	satSet.onLoadSatData(searchBox.init);
  
  resizeCanvas();
  $(window).resize(resizeCanvas);
  
  var can = $('#canvas')[0];   
  
  gl = webGlInit(can);
  debugLine = new Line();
  debugLine2 = new Line();
  debugLine3 = new Line();
  earth.init();
  ColorScheme.init();
  satSet.init();
  orbitDisplay.init();

   /* var rotSpeed = 0.001;
    $(document).keydown(function(evt) {
      if(evt.which === 83) camPitchSpeed = -rotSpeed; //S
      if(evt.which === 87) camPitchSpeed = rotSpeed; //W
      if(evt.which === 68) camYawSpeed = rotSpeed; //D
      if(evt.which === 65) camYawSpeed = -rotSpeed; //A
    });
    
    $(document).keyup(function (evt) {
       if(evt.which === 83) camPitchSpeed = 0; //S
      if(evt.which === 87) camPitchSpeed =0; //W
      if(evt.which === 68) camYawSpeed = 0; //D
      if(evt.which === 65) camYawSpeed = 0; //A
    });*/
    
    $('#canvas').mousemove(function(evt) {
      mouseX = evt.clientX;
      mouseY = evt.clientY;
    });
    
    $('#canvas').on('wheel', function (evt) {
      zoomTarget += evt.originalEvent.deltaY * 0.0002;
      if(zoomTarget > 1) zoomTarget = 1;
      if(zoomTarget < 0) zoomTarget = 0;
    });
    
    $('#canvas').click(function(evt) {
      var clickedSat = getSatIdFromCoord(evt.clientX, evt.clientY);
      selectSat(clickedSat);
      searchBox.hideResults();
    
    });
    
    $('#canvas').contextmenu(function() {
     return false; //stop right-click menu
    });
    
    $('#canvas').mousedown(function(evt){
      if(evt.which === 3) {//RMB
        dragPoint = getEarthScreenPoint(evt.clientX, evt.clientY);
        dragStartPitch = camPitch;
        dragStartYaw = camYaw;
     //   debugLine.set(dragPoint, getCamPos());
        isDragging = true;
        camSnapMode = false;
      }
    });
    
    $('#canvas').mouseup(function(evt){
      if(evt.which === 3) {//RMB
        isDragging = false;
      }
    });
    
 //   debugContext = $('#debug-canvas')[0].getContext('2d');
 //   debugImageData = debugContext.createImageData(debugContext.canvas.width, debugContext.canvas.height);
  drawLoop(); //kick off the animationFrame()s
});

function resizeCanvas() {
  var can = $('#canvas')[0];
  can.width = window.innerWidth;
  can.height = window.innerHeight;
}

function selectSat(satId) {
  selectedSat = satId;
  if(satId === -1) {
    $('#sat-infobox').fadeOut();
     orbitDisplay.clearSelectOrbit();
  } else {
    satSet.selectSat(satId);
    camSnapToSat(satId);
    var sat = satSet.getSat(satId);
    if(!sat) return;
    orbitDisplay.setSelectOrbit(satId);
    $('#sat-infobox').fadeIn();
    $('#sat-info-title').html(sat.OBJECT_NAME);
    $('#sat-intl-des').html(sat.intlDes);
    $('#sat-type').html(sat.OBJECT_TYPE);
    $('#sat-apogee').html(sat.apogee.toFixed(0) + ' km');
    $('#sat-perigee').html(sat.perigee.toFixed(0) + ' km');
    $('#sat-inclination').html((sat.inclination * R2D).toFixed(2));  
  }
}


function webGlInit(can) {
  var gl = can.getContext('webgl', {alpha: false}) || can.getContext('experimental-webgl', {alpha: false});
  if(!gl) {
      alert('No Webgl!');
  }
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  // init shaders
  
  gl.enable(gl.DEPTH_TEST);
  
  var pFragShader = gl.createShader(gl.FRAGMENT_SHADER);
  var pFragCode = shaderLoader.getShaderCode('pick-fragment.glsl');
  gl.shaderSource(pFragShader, pFragCode);
  gl.compileShader(pFragShader);
  
  var pVertShader = gl.createShader(gl.VERTEX_SHADER);
  var pVertCode = shaderLoader.getShaderCode('pick-vertex.glsl');
  gl.shaderSource(pVertShader, pVertCode);
  gl.compileShader(pVertShader);
  
  var pickShaderProgram = gl.createProgram();
  gl.attachShader(pickShaderProgram, pVertShader);
  gl.attachShader(pickShaderProgram, pFragShader);
  gl.linkProgram(pickShaderProgram);
  
  pickShaderProgram.aPos = gl.getAttribLocation(pickShaderProgram, 'aPos');
  pickShaderProgram.aColor = gl.getAttribLocation(pickShaderProgram, 'aColor');
  pickShaderProgram.uCamMatrix = gl.getUniformLocation(pickShaderProgram, 'uCamMatrix');
  pickShaderProgram.uMvMatrix = gl.getUniformLocation(pickShaderProgram, 'uMvMatrix');
  pickShaderProgram.uPMatrix = gl.getUniformLocation(pickShaderProgram, 'uPMatrix');
  
  gl.pickShaderProgram = pickShaderProgram;
  
  pickFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, pickFb);
  
  pickTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, pickTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //makes clearing work
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  
  var rb = gl.createRenderbuffer(); //create RB to store the depth buffer
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.drawingBufferWidth, gl.drawingBufferHeight);
  
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  
  gl.pickFb = pickFb;
  
  pickColorBuf = new Uint8Array(4);
  
  pMatrix = mat4.create();
  mat4.perspective(pMatrix, 1.01, gl.drawingBufferWidth / gl.drawingBufferHeight, 20.0, 300000.0);
  var eciToOpenGlMat = [
    1,  0,  0,  0,
    0,  0, -1,  0,
    0,  1,  0,  0,
    0,  0,  0,  1
  ];
  mat4.mul(pMatrix, pMatrix, eciToOpenGlMat); //pMat = pMat * ecioglMat 
  
  return gl;
}

function getCamPos() {
  var r = getCamDist();
  var z = r * Math.sin(camPitch);
  var rYaw = r * Math.cos(camPitch);
  var x = rYaw * Math.sin(camYaw);
  var y = rYaw * Math.cos(camYaw) * -1;
  return [x, y, z];
}

function unProject(mx, my) {
  var glScreenX = (mx / gl.drawingBufferWidth * 2) - 1.0;
  var glScreenY = 1.0 - (my / gl.drawingBufferHeight * 2);
  var screenVec = [glScreenX, glScreenY, -0.01, 1.0]; //gl screen coords
 
  var comboPMat = mat4.create();
  mat4.mul(comboPMat, pMatrix, camMatrix);
  var invMat = mat4.create();
  mat4.invert(invMat, comboPMat);
  var worldVec = vec4.create();
  vec4.transformMat4(worldVec, screenVec, invMat);
 
  return [worldVec[0] / worldVec[3], worldVec[1] / worldVec[3], worldVec[2] / worldVec[3]];
}

function getEarthScreenPoint(x, y) {
//  var start = performance.now();
  
  var rayOrigin = getCamPos();
  var ptThru = unProject(x, y);

  var rayDir = vec3.create();
  vec3.subtract(rayDir, ptThru, rayOrigin); //rayDir = ptThru - rayOrigin
  vec3.normalize(rayDir, rayDir);

  var toCenterVec = vec3.create();
  vec3.scale(toCenterVec, rayOrigin, -1); //toCenter is just -camera pos because center is at [0,0,0]
  var dParallel = vec3.dot(rayDir, toCenterVec);
  
  var longDir = vec3.create();
  vec3.scale(longDir, rayDir, dParallel); //longDir = rayDir * distParallel
  vec3.add(ptThru, rayOrigin, longDir); //ptThru is now on the plane going through the center of sphere
  var dPerp = vec3.len(ptThru);
  
  var dSubSurf = Math.sqrt(6371*6371 - dPerp*dPerp);
  var dSurf = dParallel - dSubSurf;
  
  var ptSurf = vec3.create();
  vec3.scale(ptSurf, rayDir, dSurf);
  vec3.add(ptSurf, ptSurf, rayOrigin);
  
 // console.log('earthscreenpt: ' + (performance.now() - start) + ' ms');
  
  return ptSurf;
}


function getCamDist() {
  return Math.pow(zoomLevel, ZOOM_EXP) * (DIST_MAX - DIST_MIN) + DIST_MIN;
}

function camSnapToSat(satId) {
  var sat = satSet.getSat(satId);
  var pos = sat.position;
  var r = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  var yaw = Math.atan2(pos.y, pos.x) + Math.PI/2;
  var pitch = Math.atan2(pos.z, r);
  camSnap(pitch, yaw);
  
  var camDistTarget = sat.altitude + 6371 + 2000;
  zoomTarget = Math.pow((camDistTarget - DIST_MIN) / (DIST_MAX - DIST_MIN), 1/ZOOM_EXP);
}

function camSnap(pitch, yaw) {
  camPitchTarget = pitch;
  camYawTarget = yaw;
  camSnapMode = true;
}


var oldT = new Date();
function drawLoop() {
  var newT = new Date();
  var dt = newT - oldT;
  oldT = newT;
  var dragTarget = getEarthScreenPoint(mouseX, mouseY);
  if(isDragging && 
      !(isNaN(dragTarget[0]) || isNaN(dragTarget[1]) || isNaN(dragTarget[2])
       || isNaN(dragPoint[0]) || isNaN(dragPoint[1]) || isNaN(dragPoint[2]))) { 
         
    var dragPointR = Math.sqrt(dragPoint[0]*dragPoint[0] + dragPoint[1]*dragPoint[1]);
    var dragTargetR = Math.sqrt(dragTarget[0]*dragTarget[0] + dragTarget[1]*dragTarget[1]);
    
    var dragPointLon =  Math.atan2(dragPoint[1], dragPoint[0]);
    var dragTargetLon = Math.atan2(dragTarget[1], dragTarget[0]);
    
    var dragPointLat = Math.atan2(dragPoint[2] , dragPointR);
    var dragTargetLat = Math.atan2(dragTarget[2] , dragTargetR);
  
    var pitchDif = dragPointLat - dragTargetLat;
    var yawDif = dragPointLon - dragTargetLon;
    
    camPitchSpeed = pitchDif * 0.015;
    camYawSpeed = yawDif * 0.015;
  } else {
    camPitchSpeed -= (camPitchSpeed * dt * 0.005);
    camYawSpeed -= (camYawSpeed * dt * 0.005);
  }
  camPitch += camPitchSpeed * dt;
  camYaw += camYawSpeed * dt;
  if(camSnapMode) {
    camPitch += (camPitchTarget - camPitch) * 0.003 * dt;
    camYaw += (camYawTarget - camYaw) * 0.003 * dt;
    if(Math.abs(camPitchTarget - camPitch) < 0.002 && Math.abs(camYawTarget - camYaw) < 0.002) {
      camSnapMode = false;
    }
     zoomLevel = zoomLevel + (zoomTarget - zoomLevel)*dt*0.0025;
  } else {
     zoomLevel = zoomLevel + (zoomTarget - zoomLevel)*dt*0.0075;
  }
  if(camPitch > Math.PI/2) camPitch = Math.PI/2;
  if(camPitch < -Math.PI/2) camPitch = -Math.PI/2;
 
  drawScene();
  updateHover();
  updateSelectBox();
  requestAnimationFrame(drawLoop);
}


function drawScene() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);
 // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
 // gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);
 
  camMatrix = mat4.create();
  mat4.identity(camMatrix);
  mat4.translate(camMatrix, camMatrix, [0, getCamDist(), 0]);
  mat4.rotateX(camMatrix, camMatrix, camPitch);
  mat4.rotateZ(camMatrix, camMatrix, -camYaw);
  
  gl.useProgram(gl.pickShaderProgram);
    gl.uniformMatrix4fv(gl.pickShaderProgram.uPMatrix, false, pMatrix);
    gl.uniformMatrix4fv(gl.pickShaderProgram.camMatrix, false,camMatrix);
   

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  debugLine.draw();
  debugLine2.draw();
  debugLine3.draw();
  earth.draw(pMatrix, camMatrix);
  satSet.draw(pMatrix, camMatrix);
  orbitDisplay.draw(pMatrix, camMatrix);
  
  /* DEBUG - show the pickbuffer on a canvas */
 // debugImageData.data = pickColorMap;
 /* debugImageData.data.set(pickColorMap);
  debugContext.putImageData(debugImageData, 0, 0);*/
}

function updateSelectBox() {
  if(selectedSat === -1) return;
  var satData = satSet.getSat(selectedSat);
  $('#sat-altitude').html(satData.altitude.toFixed(2));
  $('#sat-velocity').html(satData.velocity.toFixed(2));
}

function updateHover() {
  mouseSat = getSatIdFromCoord(mouseX, mouseY);
  
  satSet.setHover(mouseSat);
  
  if(mouseSat === -1) {
    $('#sat-hoverbox').html('(none)');
    $('#sat-hoverbox').css({display: 'none'});
    $('#canvas').css({cursor : 'default'});
    orbitDisplay.clearHoverOrbit();
  } else {
   try{
      $('#sat-hoverbox').html(satSet.getSat(mouseSat).OBJECT_NAME);
  // $('#sat-hoverbox').html(satId);
      $('#sat-hoverbox').css({
        display: 'block',
        position: 'absolute',
        left: mouseX + 20,
        top: mouseY - 10
      });
      $('#canvas').css({cursor : 'pointer'});
      orbitDisplay.setHoverOrbit(mouseSat);
    } catch(e){}
  }
}

function getSatIdFromCoord(x, y) {
 // var start = performance.now();

  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);
  gl.readPixels(x, gl.drawingBufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pickColorBuf);
  
  var pickR = pickColorBuf[0];
  var pickG = pickColorBuf[1];
  var pickB = pickColorBuf[2];
  
 // console.log('picking op: ' + (performance.now() - start) + ' ms');
  return((pickB << 16) | (pickG << 8) | (pickR)) - 1;
}



