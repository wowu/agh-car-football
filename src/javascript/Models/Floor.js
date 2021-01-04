import * as THREE from 'three';

export default class Floor {
  constructor(_options) {
    // Container
    this.container = new THREE.Object3D();
    this.container.matrixAutoUpdate = false;

    // Geometry
    this.geometry = new THREE.PlaneBufferGeometry(4, 4, 10, 10);

    // Material
    this.material = new THREE.MeshPhongMaterial({ color: 0x2194ce });

    // Mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
    this.container.add(this.mesh);
  }
}
