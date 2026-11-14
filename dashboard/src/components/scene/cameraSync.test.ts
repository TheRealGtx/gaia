import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import { createCameraSyncChannel, type SyncedCameraView } from "./cameraSync.ts";

const buildingView = {
  environmentId: "building-a" as const,
  position: [10, 12, 14] as const,
  quaternion: [.1, .2, .3, .9] as const,
  up: [0, 1, 0] as const,
  fov: 35,
  zoom: 1.2,
  near: .1,
  far: 260,
};

test("provides a camera synchronization channel", async () => {
  const module = await import("./cameraSync.ts").catch(() => null);
  const channel = module?.createCameraSyncChannel();

  assert.equal(typeof module?.createCameraSyncChannel, "function");
  assert.equal(typeof channel?.publish, "function");
  assert.equal(typeof channel?.subscribe, "function");
});

test("delivers and replays only the latest camera view for the requested environment", () => {
  const channel = createCameraSyncChannel();
  const received: SyncedCameraView[] = [];
  const unsubscribe = channel.subscribe("building-a", (view) => received.push(view));

  channel.publish({ ...buildingView, environmentId: "forest-north" });
  channel.publish(buildingView);

  assert.deepEqual(received, [buildingView]);

  const replayed: SyncedCameraView[] = [];
  channel.subscribe("building-a", (view) => replayed.push(view));
  assert.deepEqual(replayed, [buildingView]);

  unsubscribe();
  channel.publish({ ...buildingView, position: [20, 22, 24] });
  assert.equal(received.length, 1);
});

test("copies the complete perspective-camera pose without changing the follower aspect ratio", async () => {
  const module = await import("./cameraSync.ts");
  assert.equal(typeof module.capturePerspectiveCameraView, "function");
  assert.equal(typeof module.applyPerspectiveCameraView, "function");

  const source = new PerspectiveCamera(35, 1.8, .1, 260);
  source.position.set(10, 12, 14);
  source.up.set(0, 1, 0);
  source.zoom = 1.2;
  source.lookAt(new Vector3(1, 2, 3));
  source.updateProjectionMatrix();

  const follower = new PerspectiveCamera(70, .55, 1, 20);
  const followerAspect = follower.aspect;
  const view = module.capturePerspectiveCameraView("building-a", source);
  module.applyPerspectiveCameraView(follower, view);

  assert.deepEqual(follower.position.toArray(), [10, 12, 14]);
  assert.deepEqual(follower.quaternion.toArray(), source.quaternion.toArray());
  assert.deepEqual(follower.up.toArray(), [0, 1, 0]);
  assert.equal(follower.fov, 35);
  assert.equal(follower.zoom, 1.2);
  assert.equal(follower.near, .1);
  assert.equal(follower.far, 260);
  assert.equal(follower.aspect, followerAspect);
});
