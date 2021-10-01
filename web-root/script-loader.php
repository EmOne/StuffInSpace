<?php
header('Content-type: text/javascript');
header('Access-Control-Allow-Origin: https://space.emone.co.th');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Referrer-Policy: origin-when-cross-origin');

$scriptFiles = [

//libraries
'gl-matrix-min.js',
'spin.min.js',
'perfect-scrollbar.jquery.min.js',
'satellite.js',

//our script files
'shader-loader.js',
'color-scheme.js',
'groups.js',
'search-box.js',
'orbit-display.js',
'line.js',
'earth.js',
'sun.js',
'sat.js',
'main.js'
];

$shaderFiles = [
'earth-fragment.glsl',
'earth-vertex.glsl',
'dot-fragment.glsl',
'dot-vertex.glsl',
'pick-fragment.glsl',
'pick-vertex.glsl',
'path-fragment.glsl',
'path-vertex.glsl'
];

foreach($scriptFiles as $f) {
  echo '// **** ' . $f . " ***\r\n";
  echo file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/scripts/' . $f);
  echo "\r\n// **** end " . $f . " ***\r\n\r\n";
} 

$shaderData = [];
foreach($shaderFiles as $f) {
  $shaderData[] = [
    'name' => $f,
    'code' => file_get_contents($_SERVER['DOCUMENT_ROOT'] . '/shaders/' . $f)
  ];
}
?>

var shaderData = <?= json_encode($shaderData) ?>;
