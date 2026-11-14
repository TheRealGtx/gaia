import type { EnvironmentId } from "../../domain/types.ts";
import { PerspectiveCamera } from "three";

export interface SyncedCameraView {
  environmentId: EnvironmentId;
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  up: readonly [number, number, number];
  fov: number;
  zoom: number;
  near: number;
  far: number;
}

export interface CameraSyncChannel {
  publish(view: SyncedCameraView): void;
  subscribe(environmentId: EnvironmentId, listener: (view: SyncedCameraView) => void): () => void;
}

export function capturePerspectiveCameraView(
  environmentId: EnvironmentId,
  camera: PerspectiveCamera,
): SyncedCameraView {
  return {
    environmentId,
    position: [camera.position.x, camera.position.y, camera.position.z],
    quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
    up: [camera.up.x, camera.up.y, camera.up.z],
    fov: camera.fov,
    zoom: camera.zoom,
    near: camera.near,
    far: camera.far,
  };
}

export function applyPerspectiveCameraView(camera: PerspectiveCamera, view: SyncedCameraView) {
  camera.position.fromArray(view.position);
  camera.quaternion.fromArray(view.quaternion);
  camera.up.fromArray(view.up);
  camera.fov = view.fov;
  camera.zoom = view.zoom;
  camera.near = view.near;
  camera.far = view.far;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function createCameraSyncChannel(): CameraSyncChannel {
  const latest = new Map<EnvironmentId, SyncedCameraView>();
  const listeners = new Map<EnvironmentId, Set<(view: SyncedCameraView) => void>>();

  return {
    publish(view) {
      latest.set(view.environmentId, view);
      for (const listener of listeners.get(view.environmentId) ?? []) listener(view);
    },
    subscribe(environmentId, listener) {
      const environmentListeners = listeners.get(environmentId) ?? new Set();
      environmentListeners.add(listener);
      listeners.set(environmentId, environmentListeners);
      const current = latest.get(environmentId);
      if (current) listener(current);
      return () => environmentListeners.delete(listener);
    },
  };
}
