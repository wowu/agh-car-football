import * as THREE from 'three';

import Loader from './Utils/Loader.js';
import EventEmitter from './Utils/EventEmitter.js';

// Car cyber truck
import carCyberTruckChassisSource from '../models/cyberTruck/chassis.glb';
import carCyberTruckWheelSource from '../models/cyberTruck/wheel.glb';
import carCyberTruckBackLightsBrakeSource from '../models/cyberTruck/backLightsBrake.glb';
import carCyberTruckBackLightsReverseSource from '../models/cyberTruck/backLightsReverse.glb';
import carCyberTruckAntenaSource from '../models/cyberTruck/antena.glb';

import suzanne from '../models/suzanne/suzanne.3ds';

export default class Resources extends EventEmitter {
  constructor() {
    super();

    this.loader = new Loader();
    this.items = {};

    this.loader.load([
      // Cybertruck
      // { name: 'carCyberTruckChassis', source: carCyberTruckChassisSource },
      // { name: 'carCyberTruckWheel', source: carCyberTruckWheelSource },
      // { name: 'carCyberTruckBackLightsBrake', source: carCyberTruckBackLightsBrakeSource },
      // { name: 'carCyberTruckBackLightsReverse', source: carCyberTruckBackLightsReverseSource },
      // { name: 'carCyberTruckAntena', source: carCyberTruckAntenaSource },
      { name: 'suzanne', source: suzanne },
    ]);

    this.loader.on('fileEnd', (_resource, _data) => {
      this.items[_resource.name] = _data;

      // Texture
      if (_resource.type === 'texture') {
        const texture = new THREE.Texture(_data);
        texture.needsUpdate = true;

        this.items[`${_resource.name}Texture`] = texture;
      }

      // Trigger progress
      this.trigger('progress', [this.loader.loaded / this.loader.toLoad]);
    });

    this.loader.on('end', () => {
      // Trigger ready
      this.trigger('ready');
    });
  }
}
