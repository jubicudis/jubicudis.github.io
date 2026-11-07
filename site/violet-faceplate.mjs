// A2 faceplate is a physical elliptical shell, not a planar textured quad.
// Coordinates remain registered to the inventor-approved 970x687 A2 source.
import * as THREE from './vendor/three.module.js';

export const A2_FACEPLATE=Object.freeze({
  widthPixels:475,heightPixels:326,centerX:517,centerY:320,
  depth:0.72,segmentsX:96,segmentsY:24,sideDepth:0.25
});

export function createA2FaceplateGeometry(pixelToWorld){
  if(!(pixelToWorld>0))throw new RangeError('A2 faceplate requires artwork scale');
  const {widthPixels,heightPixels,depth,segmentsX:sectors,segmentsY:rings}=A2_FACEPLATE;
  const rx=widthPixels*pixelToWorld/2,ry=heightPixels*pixelToWorld/2;
  const positions=[],uv=[],indices=[];
  // Closed elliptical front with real outward normals, not a bent rectangle.
  for(let ring=0;ring<=rings;ring++){
    const radius=ring/rings;
    for(let sector=0;sector<=sectors;sector++){
      const theta=2*Math.PI*sector/sectors;
      const x=radius*Math.cos(theta),y=radius*Math.sin(theta);
      positions.push(rx*x,ry*y,depth*Math.pow(Math.max(0,1-radius*radius),.65));
      uv.push((x+1)/2,(y+1)/2);
    }
  }
  for(let ring=0;ring<rings;ring++)for(let sector=0;sector<sectors;sector++){
    const a=ring*(sectors+1)+sector,b=a+sectors+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData.a2Faceplate={depth,segmentsX:sectors,segmentsY:rings,kind:'convex-elliptical-shell'};
  return geometry;
}

export function createA2FaceplateSideGeometry(pixelToWorld){
  if(!(pixelToWorld>0))throw new RangeError('A2 faceplate requires artwork scale');
  const {widthPixels,heightPixels,segmentsX:sectors,sideDepth}=A2_FACEPLATE;
  const rx=widthPixels*pixelToWorld/2,ry=heightPixels*pixelToWorld/2;
  const positions=[],uv=[],indices=[];
  for(let i=0;i<=sectors;i++){
    const t=i*2*Math.PI/sectors,x=Math.cos(t)*rx,y=Math.sin(t)*ry;
    positions.push(x,y,0,x*.91,y*.91,-sideDepth);
    uv.push(i/sectors,1,i/sectors,0);
  }
  for(let i=0;i<sectors;i++){const a=2*i;indices.push(a,a+2,a+1,a+2,a+3,a+1);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}
