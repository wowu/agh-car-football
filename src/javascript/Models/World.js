import * as THREE from 'three';
import Floor from './Floor.js';
// import Car from './Car.js';

export default class {
  constructor(_options) {
    // Options
    this.config = _options.config;
    this.resources = _options.resources;
    this.time = _options.time;
    this.sizes = _options.sizes;
    this.camera = _options.camera;
    this.renderer = _options.renderer;
    this.passes = _options.passes;

    this.container = new THREE.Object3D();
    this.container.matrixAutoUpdate = false;

    this.setAxes();
    this.setFloor();
  }

  start() {
    // window.setTimeout(() => {
    //   this.camera.pan.enable();
    // }, 2000);
    // this.setReveal();
    // this.setFloor();
    // this.setCar();
    // this.areas.car = this.car;
  }

  setReveal() {
    // this.physics.car.chassis.body.sleep();
    // this.physics.car.chassis.body.position.set(0, 0, 12);
    //
    // window.setTimeout(() => {
    //   this.physics.car.chassis.body.wakeUp();
    // }, 300);
  }

  setAxes() {
    this.axis = new THREE.AxesHelper();
    this.container.add(this.axis);
  }

  setFloor() {
    this.floor = new Floor({
      debug: this.debugFolder,
    });

    this.container.add(this.floor.container);
  }

  // setCar() {
  //   this.car = new Car({
  //     time: this.time,
  //     resources: this.resources,
  //     objects: this.objects,
  //     physics: this.physics,
  //     shadows: this.shadows,
  //     materials: this.materials,
  //     controls: this.controls,
  //     sounds: this.sounds,
  //     renderer: this.renderer,
  //     camera: this.camera,
  //     debug: this.debugFolder,
  //     config: this.config,
  //   });
  //   this.container.add(this.car.container);
  // }
}
