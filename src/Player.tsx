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
import { LASER_Z, laserPosition } from "./World";
import { useGame } from "./store";
import type { Scale } from "./rules";
import { suitDecision } from "./rules";
const H = 0.75,
  R = 0.34,
  HALF = 0.41,
  DT = 1 / 60;
export function Player() {
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
  const previous = useRef<Scale>(1),
    clearTime = useRef(0),
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
    return true;
  }
  useEffect(() => {
    const s = useGame.getState();
    localSize.current = 1;
    velocity.current = 0;
    body.current?.setTranslation(
      { x: s.checkpoint[0], y: s.checkpoint[1] + H + 0.03, z: s.checkpoint[2] },
      true,
    );
    collider.current?.setRadius(R);
    collider.current?.setHalfHeight(HALF);
    keys.current.clear();
    yaw.current = 0;
    pitch.current = 0.32;
    facing.current = 0;
    clearTime.current = 0;
    respawning.current = false;
  }, [screen, respawn]);
  function die(reason: string) {
    // A physics frame may contain several fixed steps before React commits.
    // Latch once until the checkpoint effect has moved the capsule.
    if (respawning.current) return;
    respawning.current = true;
    useGame.getState().die(reason);
  }
  function interact() {
    const s = useGame.getState(),
      p = s.pos;
    const near = (x: number, z: number, d = 3) =>
      Math.hypot(p[0] - x, p[2] - z) < d;
    if (
      s.stage <= 2 &&
      s.battery !== "installed" &&
      ((s.battery === "floor" && near(-5, 18)) || s.battery === "carried")
    ) {
      if (s.size !== 2.5) {
        s.notify("이 배터리는 무겁습니다. 3키로 거대화하세요.");
        return;
      }
      if (s.battery === "floor") {
        s.patch({ battery: "carried" });
        s.notify("배터리를 들었습니다. 빛나는 발전기 소켓으로 이동해 E.");
      } else if (near(4, 21, 3.6)) {
        s.patch({ battery: "installed", flash: s.flash + 1 });
        s.notify("배터리 연결 완료! 2키로 일반 크기 → 전원 콘솔에서 E.");
      } else {
        s.patch({ battery: "floor" });
        s.notify("배터리를 원래 위치에 내려놓았습니다.");
      }
      return;
    }
    if (near(4, 25) && !s.power) {
      if (s.battery !== "installed") {
        s.notify("먼저 배터리를 발전기에 연결하세요.");
        return;
      }
      if (s.size !== 1) {
        s.notify("콘솔은 일반 크기에서 조작할 수 있습니다. 2키를 누르세요.");
        return;
      }
      s.patch({ panel: "power" });
      document.exitPointerLock?.();
      return;
    }
    if (near(-4, 35) && s.power) {
      if (s.size !== 1) {
        s.notify("슈트 콘솔은 일반 크기에서 조작할 수 있습니다.");
        return;
      }
      s.patch({ panel: "suit" });
      document.exitPointerLock?.();
      return;
    }
    if (s.stage === 5 && near(0, 66, 4.7)) {
      if (s.bossPhase !== "weak") {
        s.notify(
          "보호막이 활성화되어 있습니다. 레이저를 자동 축소로 피하세요.",
        );
        return;
      }
      if (s.size !== 2.5) {
        s.notify("약점 노출! 3키로 거대화한 뒤 E로 공격하세요.");
        return;
      }
      const hp = s.bossHP - 1;
      s.patch({
        bossHP: hp,
        bossTime: 0,
        bossPhase: hp === 0 ? "defeated" : "charge",
        bossDodged: false,
        stage: hp === 0 ? 6 : 5,
        flash: s.flash + 1,
      });
      s.notify(
        hp === 0
          ? "수호자 정지! 탈출문이 열렸습니다."
          : `약점 공격 성공! 남은 코어 ${hp}개`,
      );
      return;
    }
  }
  useEffect(() => {
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
        if (s.automatic && s.ability) {
          s.notify("레이저 감지 중입니다. 안전해지면 이전 크기로 돌아갑니다.");
          return;
        }
        if (s.battery === "carried" && size !== 2.5) {
          s.notify("배터리를 연결하거나 내려놓은 후 크기를 바꿔주세요.");
          return;
        }
        changeSize(size);
      }
      if (e.code === "KeyQ") {
        if (!s.equipped)
          s.notify("슈트 콘솔에서 능력을 테스트하고 장착하세요.");
        else {
          s.patch({ ability: !s.ability });
          s.notify(
            s.ability ? "자동 축소 OFF" : "자동 축소 ON · 레이저를 감지합니다.",
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
      const s = useGame.getState();
      s.patch({ cameraCaptured: captured });
      if (!captured) {
        keys.current.clear();
        if (s.screen === "game" && !s.panel) s.patch({ panel: "pause" });
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
      if (useGame.getState().screen === "game" && !useGame.getState().panel)
        gl.domElement.requestPointerLock?.();
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
    const s = useGame.getState(),
      b = body.current,
      c = collider.current,
      cc = controller.current;
    if (s.screen !== "game" || s.panel || !b || !c || !cc || respawning.current)
      return;
    const p = b.translation(),
      size = localSize.current,
      foot = p.y - H * size;
    if (foot < -6) {
      die("연구실 아래로 떨어졌습니다");
      return;
    }
    const time = s.time + DT;
    let bossTime = s.bossTime,
      phase = s.bossPhase;
    if (s.stage === 5 && s.bossHP > 0) {
      bossTime += DT;
      const cycle = bossTime % 9;
      phase =
        cycle < 2
          ? "charge"
          : cycle < 4
            ? "fire"
            : cycle < 8
              ? s.bossDodged
                ? "weak"
                : "shield"
              : "idle";
      if (cycle < DT * 1.5 && bossTime > 1) s.patch({ bossDodged: false });
    }
    const lasers: number[] =
      s.equipped && p.z > 40 && p.z < 56
        ? LASER_Z.map((z) => laserPosition(z, time))
        : [];
    if (s.stage === 5 && phase === "fire")
      lasers.push(60 + ((bossTime % 9) - 2) * 4);
    const nearLaser =
      lasers.some((z) => Math.abs(p.z - z) < (s.program?.range || 2.4)) &&
      Math.abs(p.x) < (s.stage === 5 ? 11 : 3.8);
    if (s.equipped && s.ability && nearLaser) {
      clearTime.current = 0;
      if (!s.automatic && s.program) {
        previous.current = localSize.current;
        changeSize(
          suitDecision(
            s.program,
            true,
            localSize.current,
            previous.current,
            true,
          ).size,
          true,
        );
        s.patch({ automatic: true, pendingRestore: false });
      }
      if (
        s.stage === 5 &&
        phase === "fire" &&
        lasers.some((z) => Math.abs(z - p.z) < 0.6) &&
        localSize.current === 0.25
      )
        s.patch({ bossDodged: true });
    } else if (s.automatic) {
      clearTime.current += DT;
      if (clearTime.current > 0.3 && s.program) {
        const next = suitDecision(
          s.program,
          false,
          localSize.current,
          previous.current,
          fits(previous.current),
        );
        if (!next.waiting && changeSize(next.size, true))
          s.patch({ automatic: false, pendingRestore: false });
        else if (!s.pendingRestore) {
          s.patch({ pendingRestore: true });
          s.notify(
            "복귀 공간이 부족합니다. 안전한 곳으로 이동하면 복귀합니다.",
          );
        }
      }
    }
    const feet = b.translation().y - H * localSize.current,
      top = feet + 1.5 * localSize.current;
    if (
      lasers.some((z) => Math.abs(p.z - z) < R * localSize.current + 0.12) &&
      feet < 0.92 &&
      top > 0.65 &&
      Math.abs(p.x) < (s.stage === 5 ? 11 : 3.6)
    ) {
      die("레이저에 맞았습니다");
      return;
    }
    const forward =
        (keys.current.has("KeyW") ? 1 : 0) - (keys.current.has("KeyS") ? 1 : 0),
      right =
        (keys.current.has("KeyD") ? 1 : 0) - (keys.current.has("KeyA") ? 1 : 0);
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
      s.patch({ tutorial: s.tutorial | 1 });
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
    ground.current = cc.computedGrounded();
    if (ground.current && velocity.current < 0) velocity.current = 0;
    b.setNextKinematicTranslation({
      x: p.x + delta.x,
      y: b.translation().y + delta.y,
      z: p.z + delta.z,
    });
    let prompt = "";
    const near = (x: number, z: number, d = 3) =>
      Math.hypot(p.x - x, p.z - z) < d;
    if (s.battery === "floor" && near(-5, 18))
      prompt = "E  배터리 들기 · 거대 크기";
    if (s.battery === "carried")
      prompt = near(4, 21, 3.6)
        ? "E  발전기에 배터리 연결"
        : "발전기로 배터리를 운반하세요 · E 내려놓기";
    if (near(4, 25) && !s.power) prompt = "E  전원 명령 블록 · 일반 크기";
    if (near(-4, 35) && s.power) prompt = "E  슈트 개발 콘솔 · 일반 크기";
    if (s.stage === 5 && near(0, 66, 4.7))
      prompt =
        phase === "weak"
          ? "3 거대화 → E 약점 공격"
          : "자동 축소로 레이저를 피하면 약점 노출";
    let stage = s.stage;
    if (stage === 0 && (p.z > 2 || s.tutorial > 0)) stage = 1;
    if (stage < 2 && p.z > 12) {
      stage = 2;
      s.patch({ checkpoint: [0, 0, 14] });
      s.notify("환풍구 통과! 거대화해서 배터리를 옮기세요.");
    }
    if (s.power && stage < 3) stage = 3;
    if (s.equipped && stage < 4) stage = 4;
    if (s.equipped && stage === 4 && p.z > 56) {
      stage = 5;
      bossTime = 0;
      s.patch({ checkpoint: [0, 0, 58], bossDodged: false });
      s.notify("수호자 작동! 자동 축소로 레이저를 피한 뒤 코어를 공격하세요.");
    }
    if (s.bossHP === 0 && p.z > 75.5) {
      s.patch({ screen: "clear" });
      document.exitPointerLock?.();
    }
    s.patch({ time, stage, bossTime, bossPhase: phase });
    lastSync.current += DT;
    if (lastSync.current > 0.06) {
      lastSync.current = 0;
      s.patch({
        pos: [p.x, foot, p.z],
        yaw: facing.current,
        moving,
        airborne: !ground.current,
        prompt,
      });
    }
  });
  useFrame((_, dt) => {
    const s = useGame.getState(),
      b = body.current;
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
  });
  const moving = useGame((s) => s.moving),
    airborne = useGame((s) => s.airborne);
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
        <Character id={selected} moving={moving} airborne={airborne} />
      </group>
    </>
  );
}
