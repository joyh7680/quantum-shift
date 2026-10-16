import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
} from "@react-three/rapier";
import type { RapierCollider, RapierRigidBody } from "@react-three/rapier";
import { Group, MathUtils, Raycaster, Vector3 } from "three";
import { Character } from "./Character";
import type { CharacterMotion } from "./characterAnimation";
import {
  interactLab,
  labPrompt,
  updateLab,
  tickProgram,
} from "./stages/lab/gameplay";
import {
  interactCircuit,
  circuitPrompt,
  updateCircuit,
} from "./stages/circuit/gameplay";
import type { StageRuntime } from "./stages/shared";
import { useGame } from "./store";
import type { Scale } from "./rules";
import {
  tutorialMovement,
  tutorialSizeChanged,
} from "./stages/lab/tutorialState";
const H = 0.75,
  R = 0.34,
  HALF = 0.41,
  DT = 1 / 60;
export function Player() {
  const motion = useRef<CharacterMotion>({
    speed: 0,
    airborne: false,
    paused: false,
  });
  const { world, rapier } = useRapier();
  const { camera, gl, scene } = useThree();
  const body = useRef<RapierRigidBody>(null),
    collider = useRef<RapierCollider>(null),
    model = useRef<Group>(null);
  const keys = useRef(new Set<string>()),
    yaw = useRef(0),
    pitch = useRef(0.32),
    velocity = useRef(0),
    ground = useRef(false);
  const runtime = useRef<StageRuntime>({ previous: 1, clearTime: 0 }),
    controller = useRef<ReturnType<
      typeof world.createCharacterController
    > | null>(null);
  const localSize = useRef<Scale>(1),
    lastSync = useRef(0),
    distance = useRef(7),
    facing = useRef(0),
    jumpQueued = useRef(false),
    respawning = useRef(false);
  const selected = useGame((s) => s.character),
    screen = useGame((s) => s.screen),
    respawn = useGame((s) => s.respawn);
  const ray = useRef(new Raycaster()),
    desired = new Vector3(),
    target = new Vector3();
  useEffect(() => {
    const c = world.createCharacterController(0.015);
    c.enableAutostep(0.22, 0.18, true);
    c.enableSnapToGround(0.18);
    c.setSlideEnabled(true);
    controller.current = c;
    return () => {
      world.removeCharacterController(c);
      controller.current = null;
    };
  }, [world]);
  function fits(size: Scale) {
    if (!body.current || !collider.current) return false;
    const p = body.current.translation(),
      foot = p.y - H * localSize.current;
    let blocked = false;
    world.intersectionsWithShape(
      { x: p.x, y: foot + H * size + 0.045, z: p.z },
      { x: 0, y: 0, z: 0, w: 1 },
      new rapier.Capsule(HALF * size, R * size),
      () => {
        blocked = true;
        return false;
      },
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      collider.current,
      body.current,
    );
    return !blocked;
  }
  function changeSize(size: Scale, automatic = false) {
    if (!body.current || !collider.current) return false;
    if (size === localSize.current) return true;
    if (size > localSize.current && !fits(size)) {
      if (!automatic)
        useGame
          .getState()
          .notify("확대할 공간이 부족합니다. 천장이나 물체에서 떨어져 주세요.");
      return false;
    }
    const p = body.current.translation();
    p.y += H * (size - localSize.current) + 0.005;
    collider.current.setRadius(R * size);
    collider.current.setHalfHeight(HALF * size);
    body.current.setTranslation(p, true);
    localSize.current = size;
    useGame.getState().patch({ size, flash: useGame.getState().flash + 1 });
    const s = useGame.getState();
    if (s.activeStage === 1 && !automatic && !s.panel) {
      const labTutorial = tutorialSizeChanged(s.labTutorial);
      if (labTutorial !== s.labTutorial) s.patch({ labTutorial });
    }
    return true;
  }
  useEffect(() => {
    const s = useGame.getState();
    if (s.screen !== "game") return;
    const progress = s.activeStage === 1 ? s.lab : s.circuit;
    localSize.current = 1;
    velocity.current = 0;
    body.current?.setTranslation(
      {
        x: progress.checkpoint[0],
        y: progress.checkpoint[1] + H + 0.03,
        z: progress.checkpoint[2],
      },
      true,
    );
    collider.current?.setRadius(R);
    collider.current?.setHalfHeight(HALF);
    keys.current.clear();
    yaw.current = 0;
    pitch.current = 0.32;
    facing.current = 0;
    runtime.current = { previous: 1, clearTime: 0 };
    jumpQueued.current = false;
    lastSync.current = 0;
    ground.current = false;
    respawning.current = false;
    motion.current = { speed: 0, airborne: false, paused: false };
  }, [screen, respawn]);
  function die(reason: string) {
    // A physics frame may contain several fixed steps before React commits.
    // Latch once until the checkpoint effect has moved the capsule.
    if (respawning.current) return;
    respawning.current = true;
    useGame.getState().die(reason);
  }
  function interact() {
    if (useGame.getState().activeStage === 1) interactLab();
    else interactCircuit();
  }
  useEffect(() => {
    let releasedByClick = false;
    const down = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const s = useGame.getState();
      if (s.screen !== "game") return;
      if (
        [
          "Space",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Digit1",
          "Digit2",
          "Digit3",
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.code === "Escape") {
        if (s.activeStage === 1 && s.panel === "power") return;
        if (s.panel === null) {
          s.patch({ panel: "pause" });
          document.exitPointerLock?.();
        }
        return;
      }
      if (s.panel) return;
      keys.current.add(e.code);
      if (e.repeat) return;
      if (e.code === "Space") jumpQueued.current = true;
      const size = (
        { Digit1: 0.25, Digit2: 1, Digit3: 2.5 } as Record<string, Scale>
      )[e.code];
      if (size) {
        if (s.activeStage === 2 && s.circuit.automatic && s.circuit.ability) {
          s.notify("레이저 감지 중입니다. 안전해지면 이전 크기로 돌아갑니다.");
          return;
        }
        if (
          s.activeStage === 1 &&
          s.lab.battery === "carried" &&
          size !== 2.5
        ) {
          s.notify("배터리를 연결하거나 내려놓은 후 크기를 바꿔주세요.");
          return;
        }
        changeSize(size);
      }
      if (e.code === "KeyQ" && s.activeStage === 2) {
        if (!s.circuit.equipped)
          s.notify("슈트 콘솔에서 능력을 테스트하고 장착하세요.");
        else {
          s.patchCircuit({ ability: !s.circuit.ability });
          s.notify(
            s.circuit.ability
              ? "자동 축소 OFF"
              : "자동 축소 ON · 레이저를 감지합니다.",
          );
        }
      }
      if (e.code === "KeyE") interact();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const mouse = (e: MouseEvent) => {
      if (
        document.pointerLockElement === gl.domElement &&
        !useGame.getState().panel
      ) {
        yaw.current -= e.movementX * 0.0025;
        pitch.current = MathUtils.clamp(
          pitch.current + e.movementY * 0.002,
          0.06,
          1.05,
        );
      }
    };
    const lock = () => {
      const captured = document.pointerLockElement === gl.domElement;
      const intentionalRelease = releasedByClick;
      releasedByClick = false;
      const s = useGame.getState();
      s.patch({ cameraCaptured: captured });
      if (!captured) {
        keys.current.clear();
        if (!intentionalRelease && s.screen === "game" && !s.panel)
          s.patch({ panel: "pause" });
      }
    };
    const blur = () => {
      keys.current.clear();
      if (useGame.getState().screen === "game" && !useGame.getState().panel) {
        useGame.getState().patch({ panel: "pause" });
        document.exitPointerLock?.();
      }
    };
    const click = () => {
      const s = useGame.getState();
      if (s.screen !== "game" || s.panel) return;
      if (document.pointerLockElement === gl.domElement) {
        // Releasing mouse look by clicking should keep exploration running.
        releasedByClick = true;
        document.exitPointerLock?.();
      } else {
        gl.domElement.requestPointerLock?.();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", mouse);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerlockchange", lock);
    gl.domElement.addEventListener("click", click);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", mouse);
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerlockchange", lock);
      gl.domElement.removeEventListener("click", click);
    };
  }, [gl, world]);
  useBeforePhysicsStep(() => {
    motion.current.speed = 0;
    const s = useGame.getState(),
      b = body.current,
      c = collider.current,
      cc = controller.current;
    if (
      s.screen !== "game" ||
      (s.panel &&
        !(
          s.activeStage === 1 &&
          s.panel === "power" &&
          s.lab.run === "running"
        )) ||
      !b ||
      !c ||
      !cc ||
      respawning.current
    )
      return;
    const p = b.translation(),
      size = localSize.current,
      foot = p.y - H * size;
    if (foot < -6) {
      die("연구실 아래로 떨어졌습니다");
      return;
    }
    const frame = {
      pos: [p.x, foot, p.z] as [number, number, number],
      size,
      dt: DT,
      runtime: runtime.current,
      changeSize,
      fits,
      die,
    };
    if (s.activeStage === 1 && s.panel === "power") {
      keys.current.clear();
      jumpQueued.current = false;
      tickProgram({
        ...frame,
        moveTo: (destination) => {
          const delta = new Vector3(
            destination[0] - p.x,
            0,
            destination[2] - p.z,
          );
          if (delta.length() < 0.09) return true;
          facing.current = Math.atan2(delta.x, delta.z);
          delta
            .normalize()
            .multiplyScalar((localSize.current === 0.25 ? 3.2 : 4.5) * DT);
          cc.computeColliderMovement(
            c,
            { x: delta.x, y: -0.04, z: delta.z },
            rapier.QueryFilterFlags.EXCLUDE_SENSORS,
            undefined,
            (col) => col.handle !== c.handle,
          );
          const movement = cc.computedMovement();
          ground.current = cc.computedGrounded();
          motion.current.speed =
            Math.hypot(movement.x, movement.z) / DT / localSize.current;
          b.setNextKinematicTranslation({
            x: p.x + movement.x,
            y: p.y + movement.y,
            z: p.z + movement.z,
          });
          s.patch({
            moving: motion.current.speed > 0.05,
            airborne: !ground.current,
            yaw: facing.current,
          });
          return false;
        },
      });
      const now = b.translation();
      s.patch({ pos: [now.x, now.y - H * localSize.current, now.z] });
      return;
    }
    if (s.activeStage === 1) {
      if (updateLab(frame) === false) return;
      const current = useGame.getState();
      current.advanceLabTutorial(DT, frame.pos, size);
    } else if (updateCircuit(frame) === false) return;
    if (useGame.getState().screen !== "game") return;
    const forward =
        (keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) -
        (keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0),
      right =
        (keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) -
        (keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0);
    const move = new Vector3(
      Math.sin(yaw.current) * forward - Math.cos(yaw.current) * right,
      0,
      Math.cos(yaw.current) * forward + Math.sin(yaw.current) * right,
    );
    const moving = move.lengthSq() > 0;
    if (moving) {
      move.normalize();
      facing.current = Math.atan2(move.x, move.z);
    }
    const speed =
      localSize.current === 0.25 ? 2.8 : localSize.current === 2.5 ? 5 : 4;
    if (jumpQueued.current && ground.current) {
      velocity.current = localSize.current === 0.25 ? 3.6 : 6.4;
    }
    jumpQueued.current = false;
    velocity.current = Math.max(-24, velocity.current - 18 * DT);
    cc.computeColliderMovement(
      c,
      {
        x: move.x * speed * DT,
        y: velocity.current * DT,
        z: move.z * speed * DT,
      },
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (col) => col.handle !== c.handle,
    );
    const delta = cc.computedMovement();
    motion.current.speed =
      Math.hypot(delta.x, delta.z) / DT / localSize.current;
    if (s.activeStage === 1 && moving) {
      const current = useGame.getState();
      const labTutorial = tutorialMovement(
        current.labTutorial,
        Math.hypot(delta.x, delta.z),
      );
      if (labTutorial !== current.labTutorial) current.patch({ labTutorial });
    }
    ground.current = cc.computedGrounded();
    if (ground.current && velocity.current < 0) velocity.current = 0;
    b.setNextKinematicTranslation({
      x: p.x + delta.x,
      y: b.translation().y + delta.y,
      z: p.z + delta.z,
    });
    const prompt =
      s.activeStage === 1 ? labPrompt(frame.pos) : circuitPrompt(frame.pos);
    lastSync.current += DT;
    if (lastSync.current > 0.06) {
      lastSync.current = 0;
      s.patch({
        pos: [p.x, foot, p.z],
        yaw: facing.current,
        moving: moving && motion.current.speed > 0.05,
        airborne: !ground.current,
        prompt,
      });
    }
  });
  // Publish motion and the parent transform before Character animates its limbs.
  useFrame((_, dt) => {
    const s = useGame.getState(),
      b = body.current;
    motion.current.airborne = !ground.current;
    motion.current.paused =
      s.screen !== "game" ||
      !!(s.panel && !(s.activeStage === 1 && s.panel === "power"));
    if (s.screen === "start") {
      camera.position.lerp(new Vector3(15, 18, -20), Math.min(1, dt * 3));
      camera.lookAt(0, 1, 10);
      return;
    }
    if (!b) return;
    const p = b.translation();
    if (model.current) {
      model.current.position.set(p.x, p.y - H * localSize.current, p.z);
      model.current.scale.lerp(
        new Vector3().setScalar(localSize.current),
        1 - Math.exp(-dt * 18),
      );
      model.current.rotation.y = MathUtils.lerp(
        model.current.rotation.y,
        facing.current,
        1 - Math.exp(-dt * 15),
      );
    }
    if (s.activeStage === 1 && s.panel === "power") {
      // The coding camera follows independently and remains mouse-controllable
      // while the program owns character movement.
      return;
    }
    target.set(p.x, p.y + H * localSize.current * 0.2, p.z);
    distance.current = MathUtils.lerp(
      distance.current,
      localSize.current === 0.25 ? 3.5 : localSize.current === 2.5 ? 10.5 : 6,
      1 - Math.exp(-dt * 5),
    );
    desired.set(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current),
    );
    ray.current.set(target, desired);
    ray.current.far = distance.current;
    const hit = ray.current
      .intersectObjects(scene.children, true)
      .find((h) => h.object.userData.cameraSolid && h.distance > 0.1);
    const dist = hit ? Math.max(0.23, hit.distance - 0.23) : distance.current;
    const destination = target.clone().addScaledVector(desired, dist);
    // Snap inward immediately; ease outward to keep the camera out of walls.
    if (camera.position.distanceTo(target) > dist + 0.25)
      camera.position.copy(destination);
    else camera.position.lerp(destination, 1 - Math.exp(-dt * 9));
    camera.lookAt(target);
  }, -1);
  return (
    <>
      <RigidBody
        ref={body}
        type="kinematicPosition"
        colliders={false}
        position={[0, H + 0.03, -2]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider ref={collider} args={[HALF, R]} friction={0} />
      </RigidBody>
      <group ref={model} visible={screen !== "start"}>
        <Character id={selected} motion={motion} />
      </group>
    </>
  );
}
