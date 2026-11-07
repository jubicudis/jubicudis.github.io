import assert from 'node:assert/strict';
import {test} from 'node:test';
import {A2_FACEPLATE,createA2FaceplateGeometry,createA2FaceplateSideGeometry} from '../site/violet-faceplate.mjs';

test('approved A2 faceplate is genuinely convex rather than planar',()=>{
  const geometry=createA2FaceplateGeometry(6.65/970);
  const p=geometry.getAttribute('position');
  const z=Array.from({length:p.count},(_,i)=>p.getZ(i));
  assert.ok(p.count>1000,'curved plate must be finely subdivided');
  assert.ok(Math.max(...z)>.20,'plate must have measurable physical depth');
  assert.ok(Math.max(...z)-Math.min(...z)>.20,'not a flat billboard');
  assert.ok(Math.min(...z)===0,'perimeter joins the original artwork');
  assert.equal(geometry.userData.a2Faceplate.kind,'convex-elliptical-shell');
  const side=createA2FaceplateSideGeometry(6.65/970);
  const sidePositions=side.getAttribute('position');
  assert.ok(sidePositions.count>150,'physical shell must have sidewalls');
  assert.ok(Array.from({length:sidePositions.count},(_,i)=>sidePositions.getZ(i)).some(z=>z<-.2),'sidewalls must have actual thickness');
  side.dispose();
  assert.equal(A2_FACEPLATE.centerX,517);
  geometry.dispose();
});
