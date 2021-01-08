import * as THREE from 'three';
import * as CANNON from 'cannon';
import ThreeOrbitControls from 'three-orbit-controls';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect } from 'postprocessing';
import * as dat from 'dat.gui';
import Stats from 'stats.js';

import Sizes from './Utils/Sizes.js';
import Time from './Utils/Time.js';
import Resources from './Resources';
import World from './Models/World';

const OrbitControls = ThreeOrbitControls(THREE);

export default class Application {
  /**
   * Constructor
   */
  constructor(_options) {
    // Options
    this.$canvas = _options.$canvas;
    this.useComposer = _options.useComposer;
    this.enableSMAA = _options.enableSMAA;

    // Set up
    this.time = new Time();
    this.sizes = new Sizes();
    this.resources = new Resources();

    this.setStats();

    this.resources.on('progress', (progress) => {
      console.log('Progress:', progress);
    });

    this.resources.on('ready', () => {
      // Set environment
      this.setEnvironment();
      this.initCannon();
      // Set debug
      this.setDebug();

      this.setWorld();
    });
  }

  setStats() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);
  }

  /**
   * Set environments
   */
  setEnvironment() {
    // Scene
    this.scene = new THREE.Scene();
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.$canvas });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height);

    // Camera
    const aspectRatio = this.sizes.viewport.width / this.sizes.viewport.height;
    this.camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 100);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(3, 3, 2);
    this.camera.lookAt(new THREE.Vector3());
    this.scene.add(this.camera);

    // Controls
    this.controls = new OrbitControls(this.camera, this.$canvas);

    // Light
    const light = new THREE.AmbientLight(0x909090); // soft white light
    this.scene.add(light);

    // Suzanne
    this.resources.items.suzanne.geometry.scale(0.5, 0.5, 0.5);
    this.suzanne = new THREE.Mesh(
      this.resources.items.suzanne.geometry,
      new THREE.MeshNormalMaterial()
    );
    this.suzanne.position.set(2, 0, 0);
    this.scene.add(this.suzanne);

    // this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5), new THREE.MeshNormalMaterial());
    // this.scene.add(this.mesh);

    // Composer
    this.composer = new EffectComposer(this.renderer, { depthTexture: false });

    // Passes
    this.passes = {};
    this.passes.list = [];
    this.passes.updateRenderToScreen = () => {
      let enabledPassFound = false;

      for (let i = this.passes.list.length - 1; i >= 0; i--) {
        const pass = this.passes.list[i];

        if (pass.enabled && !enabledPassFound) {
          pass.renderToScreen = true;
          enabledPassFound = true;
        } else {
          pass.renderToScreen = false;
        }
      }
    };

    this.passes.render = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.passes.render);
    this.passes.list.push(this.passes.render);

    // SMAA antialiasing
    this.passes.smaa = new EffectPass(
      this.camera,
      new SMAAEffect(this.resources.searchImage, this.resources.areaImage)
    );
    this.passes.smaa.enabled = this.enableSMAA && window.devicePixelRatio <= 1;
    this.composer.addPass(this.passes.smaa);
    this.passes.list.push(this.passes.smaa);

    this.passes.updateRenderToScreen();

    // Time tick
    this.time.on('tick', () => {
      this.stats.begin();

      this.updatePhysics();

      // Renderer
      if (this.useComposer) {
        this.composer.render(this.scene, this.camera);
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      this.stats.end();
    });

    // Resize event
    this.sizes.on('resize', () => {
      this.camera.aspect = this.sizes.viewport.width / this.sizes.viewport.height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height);

      if (this.useComposer) {
        for (const _pass of this.passes.list) {
          if (_pass.setSize) {
            _pass.setSize(this.sizes.viewport.width, this.sizes.viewport.height);
          }
        }
        this.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height);
      }
    });
  }

  setWorld() {
    this.ground = new World({
      resources: this.resources,
    });
    this.scene.add(this.ground.container);
  }

  updatePhysics() {
    // this.suzanne.rotation.z += 0.01;
    // Step the physics world
    this.world.step(1 / 60);

    // Copy coordinates from Cannon.js to Three.js
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    // this.ground.floor.container.position.copy(this.body.position);
    // this.ground.floor.container.quaternion.copy(this.body.quaternion);
  }

  initCannon() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, 0, -9.81);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    let shape = new CANNON.Box(new CANNON.Vec3(0.1, 0.2, 0.3));
    this.mass = 1;
    this.body = new CANNON.Body({
      mass: 1,
    });
    this.body.addShape(shape);
    this.body.position.set(0, 0.1, 2);
    this.currentMaterial = new THREE.MeshNormalMaterial();
    this.mesh = this.shape2mesh(this.body);

    this.scene.add(this.mesh);
    this.body.angularVelocity.set(0, 0.1, 0);
    // this.body.angularDamping = 0.5;
    this.world.addBody(this.body);

    var groundMaterial = new CANNON.Material('groundMaterial');
    var wheelMaterial = new CANNON.Material('wheelMaterial');
    var wheelGroundContactMaterial = (window.wheelGroundContactMaterial = new CANNON.ContactMaterial(
      wheelMaterial,
      groundMaterial,
      {
        friction: 0.3,
        restitution: 0,
        contactEquationStiffness: 1000,
      }
    ));
    this.world.addContactMaterial(wheelGroundContactMaterial);

    var groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({ mass: 0 });
    this.groundBody.addShape(groundShape);
    this.groundBody.position.set(0, 0, 0);

    this.world.addBody(this.groundBody);

    //
    // var chassisShape;
    // chassisShape = new CANNON.Box(new CANNON.Vec3(2, 1,0.5));
    // this.chassisBody = new CANNON.Body({ mass: this.mass });
    // this.chassisBody.addShape(chassisShape);
    // this.chassisBody.position.set(0, 0, 4);
    // this.chassisBody.angularVelocity.set(0, 0, 0.5);
    //
    // this.currentMaterial = new THREE.MeshNormalMaterial()
    // this.chassisBody = this.shape2mesh(this.body)
    //
    // this.scene.add(this.chassisBody)
    // // this.demo.addVisual(chassisBody);
    //
    // var options = {
    //   radius: 0.5,
    //   directionLocal: new CANNON.Vec3(0, 0, -1),
    //   suspensionStiffness: 30,
    //   suspensionRestLength: 0.3,
    //   frictionSlip: 5,
    //   dampingRelaxation: 2.3,
    //   dampingCompression: 4.4,
    //   maxSuspensionForce: 100000,
    //   rollInfluence:  0.01,
    //   axleLocal: new CANNON.Vec3(0, 1, 0),
    //   chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
    //   maxSuspensionTravel: 0.3,
    //   customSlidingRotationalSpeed: -30,
    //   useCustomSlidingRotationalSpeed: true
    // };
    //
    // // Create the vehicle
    // this.vehicle = new CANNON.RaycastVehicle({
    //   chassisBody: this.chassisBody,
    // });
    //
    // options.chassisConnectionPointLocal.set(1, 1, 0);
    // this.vehicle.addWheel(options);
    //
    // options.chassisConnectionPointLocal.set(1, -1, 0);
    // this.vehicle.addWheel(options);
    //
    // options.chassisConnectionPointLocal.set(-1, 1, 0);
    // this.vehicle.addWheel(options);
    //
    // options.chassisConnectionPointLocal.set(-1, -1, 0);
    // this.vehicle.addWheel(options);
    //
    // this.vehicle.addToWorld(this.world);
    //
    // var wheelBodies = [];
    // for(var i=0; i<this.vehicle.wheelInfos.length; i++){
    //   var wheel = vehicle.wheelInfos[i];
    //   var cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
    //   var wheelBody = new CANNON.Body({
    //     mass: 0
    //   });
    //   wheelBody.type = CANNON.Body.KINEMATIC;
    //   wheelBody.collisionFilterGroup = 0; // turn off collisions
    //   var q = new CANNON.Quaternion();
    //   q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    //   wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
    //   wheelBodies.push(wheelBody);
    //
    //   this.currentMaterial = new THREE.MeshNormalMaterial()
    //   this.wheelBody = this.shape2mesh(wheelBody)
    //
    //   this.scene.add(this.wheelBody)

    // demo.addVisual(wheelBody);
    // this.world.addBody(wheelBody);
    // }
    //
    // world.addEventListener('postStep', function(){
    //   for (var i = 0; i < this.vehicle.wheelInfos.length; i++) {
    //     this.vehicle.updateWheelTransform(i);
    //     var t = this.vehicle.wheelInfos[i].worldTransform;
    //     var wheelBody = wheelBodies[i];
    //     wheelBody.position.copy(t.position);
    //     wheelBody.quaternion.copy(t.quaternion);
    //   }
    // });
  }
  /**
   * Set debug
   */
  setDebug() {
    this.debug = new dat.GUI();

    const cameraFolder = this.debug.addFolder('camera');
    cameraFolder
      .add(this.camera, 'fov', 0, 100)
      .onChange(() => this.camera.updateProjectionMatrix());

    this.debug.add(this.mesh.scale, 'x', 0.01, 3, 0.001);
    this.debug.add(this.mesh.scale, 'y', 0.01, 3, 0.001);
    this.debug.add(this.mesh.scale, 'z', 0.01, 3, 0.001);
  }

  /**
   * Destructor
   */
  destructor() {
    this.time.off('tick');
    this.sizes.off('resize');

    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
    this.debug.destroy();
  }

  shape2mesh(body) {
    // var wireframe = this.settings.renderMode === "wireframe";
    var obj = new THREE.Object3D();

    for (var l = 0; l < body.shapes.length; l++) {
      var shape = body.shapes[l];

      var mesh;

      switch (shape.type) {
        case CANNON.Shape.types.SPHERE:
          var sphere_geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
          mesh = new THREE.Mesh(sphere_geometry, this.currentMaterial);
          break;

        case CANNON.Shape.types.PARTICLE:
          mesh = new THREE.Mesh(this.particleGeo, this.particleMaterial);
          var s = this.settings;
          mesh.scale.set(s.particleSize, s.particleSize, s.particleSize);
          break;

        case CANNON.Shape.types.PLANE:
          var geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
          mesh = new THREE.Object3D();
          var submesh = new THREE.Object3D();
          var ground = new THREE.Mesh(geometry, this.currentMaterial);
          ground.scale.set(100, 100, 100);
          submesh.add(ground);

          ground.castShadow = true;
          ground.receiveShadow = true;

          mesh.add(submesh);
          break;

        case CANNON.Shape.types.BOX:
          var box_geometry = new THREE.BoxGeometry(
            shape.halfExtents.x * 2,
            shape.halfExtents.y * 2,
            shape.halfExtents.z * 2
          );
          mesh = new THREE.Mesh(box_geometry, this.currentMaterial);
          break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
          var geo = new THREE.Geometry();

          // Add vertices
          for (var i = 0; i < shape.vertices.length; i++) {
            var v = shape.vertices[i];
            geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
          }

          for (var i = 0; i < shape.faces.length; i++) {
            var face = shape.faces[i];

            // add triangles
            var a = face[0];
            for (var j = 1; j < face.length - 1; j++) {
              var b = face[j];
              var c = face[j + 1];
              geo.faces.push(new THREE.Face3(a, b, c));
            }
          }
          geo.computeBoundingSphere();
          geo.computeFaceNormals();
          mesh = new THREE.Mesh(geo, this.currentMaterial);
          break;

        case CANNON.Shape.types.HEIGHTFIELD:
          var geometry = new THREE.Geometry();

          var v0 = new CANNON.Vec3();
          var v1 = new CANNON.Vec3();
          var v2 = new CANNON.Vec3();
          for (var xi = 0; xi < shape.data.length - 1; xi++) {
            for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
              for (var k = 0; k < 2; k++) {
                shape.getConvexTrianglePillar(xi, yi, k === 0);
                v0.copy(shape.pillarConvex.vertices[0]);
                v1.copy(shape.pillarConvex.vertices[1]);
                v2.copy(shape.pillarConvex.vertices[2]);
                v0.vadd(shape.pillarOffset, v0);
                v1.vadd(shape.pillarOffset, v1);
                v2.vadd(shape.pillarOffset, v2);
                geometry.vertices.push(
                  new THREE.Vector3(v0.x, v0.y, v0.z),
                  new THREE.Vector3(v1.x, v1.y, v1.z),
                  new THREE.Vector3(v2.x, v2.y, v2.z)
                );
                var i = geometry.vertices.length - 3;
                geometry.faces.push(new THREE.Face3(i, i + 1, i + 2));
              }
            }
          }
          geometry.computeBoundingSphere();
          geometry.computeFaceNormals();
          mesh = new THREE.Mesh(geometry, this.currentMaterial);
          break;

        case CANNON.Shape.types.TRIMESH:
          var geometry = new THREE.Geometry();

          var v0 = new CANNON.Vec3();
          var v1 = new CANNON.Vec3();
          var v2 = new CANNON.Vec3();
          for (var i = 0; i < shape.indices.length / 3; i++) {
            shape.getTriangleVertices(i, v0, v1, v2);
            geometry.vertices.push(
              new THREE.Vector3(v0.x, v0.y, v0.z),
              new THREE.Vector3(v1.x, v1.y, v1.z),
              new THREE.Vector3(v2.x, v2.y, v2.z)
            );
            var j = geometry.vertices.length - 3;
            geometry.faces.push(new THREE.Face3(j, j + 1, j + 2));
          }
          geometry.computeBoundingSphere();
          geometry.computeFaceNormals();
          mesh = new THREE.Mesh(geometry, this.currentMaterial);
          break;

        default:
          throw 'Visual type not recognized: ' + shape.type;
      }

      mesh.receiveShadow = true;
      mesh.castShadow = true;
      if (mesh.children) {
        for (var i = 0; i < mesh.children.length; i++) {
          mesh.children[i].castShadow = true;
          mesh.children[i].receiveShadow = true;
          if (mesh.children[i]) {
            for (var j = 0; j < mesh.children[i].length; j++) {
              mesh.children[i].children[j].castShadow = true;
              mesh.children[i].children[j].receiveShadow = true;
            }
          }
        }
      }

      var o = body.shapeOffsets[l];
      var q = body.shapeOrientations[l];
      mesh.position.set(o.x, o.y, o.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);

      obj.add(mesh);
    }

    return obj;
  }
}
