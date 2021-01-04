import * as THREE from 'three';
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

    this.scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5), new THREE.MeshNormalMaterial()));

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

      this.suzanne.rotation.z += 0.01;

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
    this.world = new World({
      resources: this.resources,
    });
    this.scene.add(this.world.container);
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

    this.debug.add(this.suzanne.scale, 'x', 0.01, 2, 0.001);
    this.debug.add(this.suzanne.scale, 'y', 0.01, 2, 0.001);
    this.debug.add(this.suzanne.scale, 'z', 0.01, 2, 0.001);
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
}
