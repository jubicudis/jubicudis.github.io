// Approved A2 facial plate: actual curved, subdivided geometry.
// The authored face texture remains the expression source. No state logic here.
import * as THREE from './vendor/three.module.js';

export const A2_FACEPLATE=Object.freeze({
  widthPixels:475,heightPixels:326,
  centerX:517,centerY:320,
  depth:0.27,segmentsX:48,segmentsY:32
});

export function createA2FaceplateGeometry(pixelToWorld){
  if(!(pixelToWorld>0))throw new RangeError('A2 faceplate requires artwork scale');
  const {widthPixels,heightPixels,depth,segmentsX,segmentsY}=A2_FACEPLATE;
  const width=widthPixels*pixelToWorld,height=heightPixels*pixelToWorld;
  const geometry=new THREE.PlaneGeometry(width,height,segmentsX,segmentsY);
  const positions=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i)/(width*.5),y=positions.getY(i)/(height*.5);
    const r=Math.min(1,Math.sqrt(x*x+y*y));
    // Convex ellipsoidal cap with continuous edge falloff. The same texture
    // follows the curvature rather than floating on a planar billboard.
    const z=depth*Math.sqrt(Math.max(0,1-r*r));
    positions.setZ(i,z);
  }
  positions.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.a2Faceplate={depth,segmentsX,segmentsY,kind:'convex-curved-mesh'};
  return geometry;
}
