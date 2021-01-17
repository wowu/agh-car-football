'use strict';

Physijs.scripts.worker = 'vendor/physijs_worker.js';
Physijs.scripts.ammo = 'ammo.js';

const json_loader = new THREE.JSONLoader();

var initScene,
  render,
  ground_material,
  renderer,
  render_stats,
  physics_stats,
  scene,
  ground,
  light,
  camera,
  vehicle,
  loader,
  config,
  input,
  ball,
  goal1,
  goal2,
  resetting = false;

var primaryCar = {},
  secondaryCar = {};
var load_obj = {};
var points = [0, 0];

vehicle = [undefined, undefined];
input = [undefined, undefined];

config = {
  power: 1500,
  suspension_stiffness: 50,
  suspension_compression: 0.083,
  suspension_damping: 100.05,
  max_suspension_travel: 50000,
  fraction_slip: 10.5,
  max_suspension_force: 6000,
  jump_force: 3000,
  camera_on_first: false,
  debug: window.location.search.substr(1) === 'debug'
};


var Axis = function (matrix, axis) {
  return new THREE.Vector3(
    matrix.elements[4 * axis],
    matrix.elements[4 * axis + 1],
    matrix.elements[4 * axis + 2]
  );
};

let resetGame = function (score1 = 0, score2 = 0, clearResults = false) {
  document.getElementById('heading').style.backgroundColor = '#c6c6c6';
  ball.position.set(0, 30, 0);
  ball.setAngularVelocity(new THREE.Vector3(0, 0, 0));
  ball.setLinearVelocity(new THREE.Vector3(0, 0, 0));
  ball.__dirtyPosition = true;
  resetVehicle(0, true);
  resetVehicle(1, true);
  points[0] += score1;
  points[1] += score2;
  document.getElementById('result1').innerHTML = points[0];
  document.getElementById('result2').innerHTML = points[1];
  if (clearResults) {
    points = [0, 0];
  }
  resetting = false;
};

let resetVehicle = function (number, initialPosition) {
  vehicle[number].mesh.position.y = 5;
  vehicle[number].mesh.setLinearVelocity(new THREE.Vector3(0, 0, 0));
  vehicle[number].mesh.setAngularVelocity(new THREE.Vector3(0, 0, 0));
  if (initialPosition) {
    vehicle[number].mesh.position.x = 0;
    vehicle[number].mesh.position.z = -20 + number * 40;
    vehicle[number].mesh.rotation.set(0, number === 1 ? Math.PI : 0, 0);
  } else {
    vehicle[number].mesh.rotation.x = 0;
    vehicle[number].mesh.rotation.z = 0;
  }
  vehicle[number].mesh.__dirtyPosition = true;
  vehicle[number].mesh.__dirtyRotation = true;
};

let jumpVehicle = function (number) {
  var vehicle_to_jump = vehicle[number];
  var force = 0.0;
  for (var i = 0; i < vehicle_to_jump.wheels.length; i++) {
    var local = new THREE.Vector3(
      vehicle_to_jump.wheels[0].matrix.elements[12],
      vehicle_to_jump.wheels[0].matrix.elements[13],
      vehicle_to_jump.wheels[0].matrix.elements[14]
    );
    var dist = local.y;
    var contraction = dist < 1.5 ? 1.0 : 0.0;
    force += contraction;
  }
  if (contraction > 0.0) {
    force = (config.jump_force * contraction) / vehicle_to_jump.wheels.length;
    vehicle_to_jump.mesh.applyCentralImpulse(new THREE.Vector3(0, force, 0));
    var v = new THREE.Vector3(
      vehicle_to_jump.mesh.matrixWorld.elements[8],
      vehicle_to_jump.mesh.matrixWorld.elements[9],
      vehicle_to_jump.mesh.matrixWorld.elements[10]
    );
  }
};

let setVehicle = function (car, number) {
  var load_car = car.load_car.clone().translate(0, -0.9, 0);
  load_car.scale(1.4, 1.4, 1.4);

  if (vehicle[number]) {
    scene.remove(vehicle[number]);
  }

  var mesh = new Physijs.ConvexMesh(
    load_car,
    new THREE.MeshFaceMaterial(car.load_car_materials),
    50
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.z = -20 + number * 40;
  mesh.position.y = 2;
  if (number === 1) {
    mesh.rotateY(Math.PI);
  }
  mesh.__dirtyPosition = true;

  vehicle[number] = new Physijs.Vehicle(
    mesh,
    new Physijs.VehicleTuning(
      config.suspension_stiffness,
      config.suspension_compression,
      config.suspension_damping,
      config.max_suspension_travel,
      config.fraction_slip,
      config.max_suspension_force
    )
  );

  vehicle[number].mesh.receiveShadow = true;
  scene.add(vehicle[number]);

  var wheel_material = new THREE.MeshFaceMaterial(car.load_wheel_materials);

  const otherWheel = car.load_wheel.clone().rotateY(Math.PI);

  for (var i = 0; i < 4; i++) {
    vehicle[number].addWheel(
      i % 2 === 0 ? car.load_wheel : otherWheel,
      wheel_material,
      new THREE.Vector3(i % 2 === 0 ? -1.6 : 1.6, -1, i < 2 ? 2.865 : -2.5),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(-1, 0, 0),
      0.5,
      0.7,
      i >= 2
    );
  }
};

initScene = function () {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMapSoft = true;
  document.getElementById('viewport').appendChild(renderer.domElement);

  if(config.debug) {
    render_stats = new Stats();
    render_stats.domElement.style.position = 'absolute';
    render_stats.domElement.style.top = '30px';
    render_stats.domElement.style.zIndex = 100;
    document.getElementById('viewport').appendChild(render_stats.domElement);

    physics_stats = new Stats();
    physics_stats.domElement.style.position = 'absolute';
    physics_stats.domElement.style.top = '30px';
    physics_stats.domElement.style.left = '80px';
    physics_stats.domElement.style.zIndex = 100;
    document.getElementById('viewport').appendChild(physics_stats.domElement);
  }

  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3(0, -30, 0));

  scene.addEventListener('update', function () {
    for (var i = 0; i < 2; i++) {
      if (input[i]) {
        if (vehicle[i]) {
          var direction = Axis(vehicle[i].mesh.matrixWorld, 2);
          var linVelocity = vehicle[i].mesh.getLinearVelocity();
          var directionalSpeed = direction.dot(linVelocity);

          if (input[i].direction !== null) {
            input[i].steering += input[i].direction / 15;
            if (input[i].steering < -0.6) input[i].steering = -0.6;
            if (input[i].steering > 0.6) input[i].steering = 0.6;
          } else {
            input[i].steering *= 0.9;
          }
          vehicle[i].setSteering(input[i].steering, 0);
          vehicle[i].setSteering(input[i].steering, 1);


          if (input[i].power === true && input[i].forward === true) {
            vehicle[i].applyEngineForce(config.power / (1 + Math.max(0.0, directionalSpeed) * 0.1));
          } else if (input[i].power === true && input[i].forward === false) {
            vehicle[i].applyEngineForce(-config.power * 0.6);
          } else {
            vehicle[i].applyEngineForce(0);
          }
        }
      }

      scene.simulate(undefined, 2);
      physics_stats.update();
    }
  });

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 2000);
  camera.position.copy(new THREE.Vector3(40, 90, 40));
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  scene.add(camera);

  // Light

  var hemisphereLight = new THREE.HemisphereLight('rgb(255,255,240)', 'rgb(191,180,153)', 1);
  scene.add(hemisphereLight);


  light = new THREE.DirectionalLight('rgb(75,75,75)', 0.2);
  light.position.set(200, 200, -150);
  light.target.position.copy(scene.position);
  light.castShadow = true;
  light.shadowCameraLeft = -100;
  light.shadowCameraTop = -100;
  light.shadowCameraRight = 100;
  light.shadowCameraBottom = 100;
  light.shadowCameraNear = 20;
  light.shadowCameraFar = 500;
  light.shadowBias = -0.0001;
  light.shadowMapWidth = light.shadowMapHeight = 4096;
  light.shadowDarkness = 0.7;
  scene.add(light);

  ball = new Physijs.SphereMesh(
    new THREE.SphereGeometry(3, 24, 24),
    Physijs.createMaterial(new THREE.MeshPhongMaterial({ color: 0xffffff , shininess: 1000}, 1, 3)),
    0.5
  );

  ball.position.set(0, 30, 0);
  ball.castShadow = true;
  ball.receiveShadow = true;
  ball.__dirtyPosition = true;

  scene.add(ball);

  goal1 = new THREE.Mesh(new THREE.BoxGeometry(15, 20, 0.2), new THREE.MeshPhongMaterial(), 0);
  goal1.position.set(-2, 0, -52);


  goal2 = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 0.2), new THREE.MeshPhongMaterial(), 0);
  goal2.position.set(-2, 0, 52);

  // Loader
  loader = new THREE.TextureLoader();

  // Materials
  ground_material = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({
      map: loader.load('images/paper.jpg'),
    }),
    0.8,
    1
  );
  ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
  ground_material.map.repeat.set(3, 3);


  // Ground

  var ground_geometry = new THREE.PlaneGeometry(300, 300, 1, 1);
  ground_geometry.computeFaceNormals();
  ground_geometry.computeVertexNormals();

  ground = new Physijs.PlaneMesh(
    ground_geometry,
    ground_material,
    0
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  json_loader.load('models/oak.json', function (oak_obj, oak_materials) {
    json_loader.load('models/birch.json', function (birch_obj, birch_materials) {
      json_loader.load('models/bumper.json', function (bumper_obj, bumper_materials) {
        load_obj.oak_obj = oak_obj;
        load_obj.oak_materials = oak_materials;
        load_obj.birch_materials = birch_materials;
        load_obj.birch_obj = birch_obj;
        load_obj.bumper_obj = bumper_obj;
        load_obj.bumper_materials = bumper_materials;

        objectsReady();
      });
    });
  });

  function placeThreeObj(obj, material, pos, rot = 0, scale = 1) {
    const meshObj = new THREE.Mesh(obj, new THREE.MeshFaceMaterial(material));
    meshObj.position.set(pos[0], pos[1], pos[2]);
    meshObj.scale.set(scale, scale, scale);
    meshObj.castShadow = true;

    meshObj.rotation.y = rot;

    scene.add(meshObj);
  }

  function placePhysiObj(obj, material, pos, rot = 0, mass = 1, scale = 1, customHeight = 0) {
    const meshObj = new Physijs.BoxMesh(obj, new THREE.MeshFaceMaterial(material), mass);
    meshObj.castShadow = true;
    meshObj.receiveShadow = true;
    meshObj.position.set(pos[0], pos[1], pos[2]);
    meshObj.scale.set(scale, scale, scale);
    if (customHeight !== 0) {
      meshObj._physijs.height = customHeight;
    }

    meshObj.rotation.y = rot;

    scene.add(meshObj);
  }

  function objectsReady() {
    placeThreeObj(load_obj.oak_obj, load_obj.oak_materials, [55, 0, -10], 0.4, 2);
    placeThreeObj(load_obj.oak_obj, load_obj.oak_materials, [-53, 0, 30], 0, 3);
    placeThreeObj(load_obj.oak_obj, load_obj.oak_materials, [10, 0, 70], 0.5, 1.5);
    placeThreeObj(load_obj.birch_obj, load_obj.birch_materials, [55, 0, 25], 0.9, 2.5);
    placeThreeObj(load_obj.birch_obj, load_obj.birch_materials, [-55, 0, -20], 0.1, 2);
    placeThreeObj(load_obj.birch_obj, load_obj.birch_materials, [-10, 0, -70], 2.3, 3);

    // placeObj(objects.bumper, [10, 0, 0], 0, true);
    for (var i = 0; i < 15; i++) {
      placePhysiObj(
        load_obj.bumper_obj,
        load_obj.bumper_materials,
        [-40, 0, i * 7 - 50],
        0,
        0,
        3,
        1000
      );
      placePhysiObj(
        load_obj.bumper_obj,
        load_obj.bumper_materials,
        [40, 0, i * 7 - 50],
        0,
        0,
        3,
        1000
      );
    }

    for (var i = 0; i < 12; i++) {
      if (i === 6 || i === 5) {
        placePhysiObj(
          load_obj.bumper_obj,
          load_obj.bumper_materials,
          [i * 7 - 40, 0, 60],
          Math.PI * 0.5,
          0,
          3,
          1000
        );
        placePhysiObj(
          load_obj.bumper_obj,
          load_obj.bumper_materials,
          [i * 7 - 40, 0, -60],
          Math.PI * 0.5,
          0,
          3,
          1000
        );
      } else {
        placePhysiObj(
          load_obj.bumper_obj,
          load_obj.bumper_materials,
          [i * 7 - 40, 0, 50],
          Math.PI * 0.5,
          0,
          3,
          1000
        );
        placePhysiObj(
          load_obj.bumper_obj,
          load_obj.bumper_materials,
          [i * 7 - 40, 0, -50],
          Math.PI * 0.5,
          0,
          3,
          1000
        );
      }
    }
    placePhysiObj(load_obj.bumper_obj, load_obj.bumper_materials, [5, 0, 55], 0, 0, 3, 1000);
    placePhysiObj(load_obj.bumper_obj, load_obj.bumper_materials, [-10, 0, 55], 0, 0, 3, 1000);
    placePhysiObj(load_obj.bumper_obj, load_obj.bumper_materials, [5, 0, -55], 0, 0, 3, 1000);
    placePhysiObj(load_obj.bumper_obj, load_obj.bumper_materials, [-10, 0, -55], 0, 0, 3, 1000);
  }

  json_loader.load('models/car1.json', function (car1, car1_materials) {
    json_loader.load('models/car2.json', function (car2, car2_materials) {
      json_loader.load('models/mustang_wheel.json', function (wheel, wheel_materials) {
        primaryCar.load_car = car1;
        primaryCar.load_car_materials = car1_materials;
        primaryCar.load_wheel = wheel;
        primaryCar.load_wheel_materials = wheel_materials;

        secondaryCar.load_car = car2;
        secondaryCar.load_car_materials = car2_materials;
        secondaryCar.load_wheel = wheel;
        secondaryCar.load_wheel_materials = wheel_materials;

        setVehicle(primaryCar, 0);
        setVehicle(secondaryCar, 1);

        input = [
          {
            power: null,
            direction: null,
            steering: 0,
            forward: true,
          },
          {
            power: null,
            direction: null,
            steering: 0,
            forward: true,
          },
        ];

        document.addEventListener('keydown', function (ev) {
          switch (ev.keyCode) {
            case 37: // left
              input[0].direction = 1;
              break;

            case 38: // forward
              input[0].power = true;
              input[0].forward = true;
              break;

            case 39: // right
              input[0].direction = -1;
              break;

            case 40: // back
              input[0].power = true;
              input[0].forward = false;
              break;

            case 65: // left
              input[1].direction = 1;
              break;

            case 87: // forward
              input[1].power = true;
              input[1].forward = true;
              break;

            case 68: // right
              input[1].direction = -1;
              break;

            case 83: // back
              input[1].power = true;
              input[1].forward = false;
              break;

            case 88: // "X"
              jumpVehicle(1);
              break;

            case 191: // "/"
              jumpVehicle(0);
              break;

            case 82: // R
              resetGame(0, 0, true);
              break;

            case 56: // 8
              resetGame(1, 0, false);
              break;
            case 57: // 9
              resetGame(0, 1, false);
              break;
          }
        });

        gameControl.on('connect', function (gamepad) {
          gamepad
            .before('button5', () => {
              // forward
              input[0].power = true;
              input[0].forward = true;
            })
            .after('button5', () => {
              input[0].power = false;
            })
            .before('button4', () => {
              // back
              input[0].power = true;
              input[0].forward = false;
            })
            .after('button4', () => {
              input[0].power = false;
            })
            .before('button14', () => {
              // left
              input[0].direction = 1;
            })
            .after('button14', () => {
              input[0].direction = null;
            })
            .before('button15', () => {
              // right
              input[0].direction = -1;
            })
            .after('button15', () => {
              input[0].direction = null;
            })
            .before('button0', () => {
              // A
              jumpVehicle(0);
            })
            .before('button1', () => {
              // B
              if (vehicle[0]) {
                resetVehicle(0, false);
              }
            })
            .before('button3', () => {
              // Y
              resetGame(0, 0, true);
            });
        });

        document.addEventListener('keyup', function (ev) {
          switch (ev.keyCode) {
            case 37: // left
              input[0].direction = null;
              break;

            case 38: // forward
              input[0].power = false;
              break;

            case 39: // right
              input[0].direction = null;
              break;

            case 40: // back
              input[0].power = false;
              break;
            case 49: // 1
              if (vehicle[0]) {
                resetVehicle(0, false);
              }
              break;
            case 50: // 2
              if (vehicle[1]) {
                resetVehicle(1, false);
              }
              break;

            case 65: // left
              input[1].direction = null;
              break;

            case 87: // forward
              input[1].power = false;
              break;

            case 68: // right
              input[1].direction = null;
              break;

            case 83: // back
              input[1].power = false;
              break;
          }
        });
      });
    });
  });



  if(config.debug) {
    const gui = new dat.GUI();
    const folder = gui.addFolder('General');
    folder.open();
    folder.add(config, 'power', 0, 30000);
    folder.add(config, 'jump_force', 1, 100000);
    folder.add(config, 'camera_on_first');
  }


  requestAnimationFrame(render);
  scene.simulate();
};

render = function () {
  requestAnimationFrame(render);

  if (vehicle[0] && vehicle[1]) {
    if (!config.camera_on_first) {
      var distance = vehicle[0].mesh.position.distanceTo(vehicle[1].mesh.position);
      camera.position
        .copy(vehicle[0].mesh.position.clone().add(vehicle[1].mesh.position).divideScalar(2.0))
        .add(new THREE.Vector3(40, 70 + distance * 0.5, 40));
      camera.lookAt(
        vehicle[0].mesh.position.clone().add(vehicle[1].mesh.position).divideScalar(2.0)
      );
    } else {
      camera.position.copy(vehicle[0].mesh.position.clone().add(new THREE.Vector3(40, 60, 40)));
      camera.lookAt(vehicle[0].mesh.position);
    }
  }

  if (ball.position.z < goal1.position.z && !resetting) {
    resetting = true;
    document.getElementById('heading').style.backgroundColor = '#00EA2D';
    setTimeout(function () {
      resetGame(0, 1);
    }, 1500);
  }

  if (ball.position.z > goal2.position.z && !resetting) {
    resetting = true;
    document.getElementById('heading').style.backgroundColor = '#6863D7';
    setTimeout(function () {
      resetGame(1, 0);
    }, 1500);
  }

  renderer.render(scene, camera);
  render_stats.update();
};

window.onload = initScene;
