import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useGame } from "../../store";
import { C, Box, Ball, Ring, Sign, Console, Gate } from "../WorldParts";
import { LASER_Z, laserPosition } from "./state";
function Lasers() {
  const refs = useRef<Group[]>([]);
  useFrame(() => {
    const t = useGame.getState().circuit.time;
    refs.current.forEach(
      (r, i) => (r.position.z = laserPosition(LASER_Z[i], t)),
    );
  });
  return (
    <>
      {LASER_Z.map((z, i) => (
        <group
          key={z}
          ref={(r) => {
            if (r) refs.current[i] = r;
          }}
          position={[0, 0, z]}
        >
          {[-1, 1].map((n) => (
            <group key={n}>
              <Box p={[n * 3.65, 0.9, 0]} s={[0.5, 1.8, 0.7]} c={C.navy} />
              <Ball p={[n * 3.4, 0.78, 0]} r={0.16} c="#ff675f" glow />
            </group>
          ))}
          <Box p={[0, 0.78, 0]} s={[6.9, 0.065, 0.07]} c="#ff5b5f" glow />
          <Box p={[0, 0.78, 0]} s={[6.9, 0.23, 0.12]} c="#ff5b5f" />
        </group>
      ))}
    </>
  );
}
function Robot() {
  const root = useRef<Group>(null),
    beam = useRef<Group>(null);
  const phase = useGame((s) => s.circuit.bossPhase);
  const hp = useGame((s) => s.circuit.bossHP);
  useFrame(() => {
    const s = useGame.getState();
    if (root.current) {
      root.current.position.y =
        hp === 0 ? -0.5 : Math.sin(s.circuit.time * 1.8) * 0.12;
      root.current.rotation.z =
        hp === 0 ? 0.25 : Math.sin(s.circuit.time) * 0.025;
    }
    if (beam.current) {
      beam.current.visible = s.circuit.bossPhase === "fire";
      beam.current.position.z = 60 + ((s.circuit.bossTime % 9) - 2) * 4;
    }
  });
  return (
    <>
      <group ref={root} position={[0, 0, 0]}>
        <Box
          p={[0, 2.4, 68]}
          s={[4, 3.7, 2.8]}
          c={hp === 0 ? "#78958d" : C.white}
          solid
        />
        <Box p={[0, 3.4, 66.52]} s={[3.2, 1.05, 0.25]} c={C.navy} />
        {[-0.8, 0.8].map((x) => (
          <Ball
            key={x}
            p={[x, 3.4, 66.3]}
            r={0.25}
            c={phase === "charge" ? "#ff6969" : C.mint}
            glow
          />
        ))}
        <Ball
          p={[0, 1.9, 66.35]}
          r={0.55}
          c={phase === "weak" ? C.orange : C.navy}
          glow={phase === "weak"}
        />
        <Ring
          p={[0, 1.9, 66.1]}
          r={0.75}
          c={phase === "weak" ? C.orange : C.purple}
          rotation={[0, 0, 0]}
        />
        {[-1, 1].map((n) => (
          <group key={n}>
            <Ball p={[n * 2.6, 2.6, 68]} r={0.7} c={C.purple} />
            <Box p={[n * 2.6, 1.3, 68]} s={[1.1, 1.7, 1.2]} c={C.navy} />
            <Box p={[n * 1.2, 0.4, 68.2]} s={[1.1, 0.8, 2.8]} c={C.navy} />
          </group>
        ))}
        <Ball p={[0, 4.9, 68]} r={0.23} c={C.orange} />
        <Sign
          p={[0, 5.7, 67]}
          text={
            hp === 0
              ? "SENTINEL / OFFLINE"
              : phase === "weak"
                ? "CORE EXPOSED / E"
                : "SENTINEL / 01"
          }
          w={4}
        />
      </group>
      <group ref={beam} visible={false}>
        <Box p={[0, 0.78, 0]} s={[22, 0.12, 0.18]} c="#ff5e69" glow />
      </group>
      {phase === "charge" && (
        <Box p={[0, 0.015, 63]} s={[21, 0.025, 8]} c="#b77069" />
      )}
    </>
  );
}

export function CircuitScene() {
  const equipped = useGame((s) => s.circuit.equipped),
    hp = useGame((s) => s.circuit.bossHP);
  return (
    <>
      <Console p={[-4, 0, 35]} title="SUIT / LAB" color={C.purple} />
      <group position={[5, 1.8, 35]}>
        <Ball p={[0, 0, 0]} r={1.1} c={C.purple} />
        <Ring p={[0, 0, 0]} r={1.5} c={C.mint} />
        <Ring p={[0, 0, 0]} r={1.5} c={C.mint} rotation={[0, 0, 0]} />
      </group>
      <Gate
        z={40}
        open={equipped}
        title="03 / SUIT REQUIRED"
        color={C.purple}
      />
      <Box p={[-4.3, 3, 48]} s={[0.5, 6, 15]} c={C.navy} solid />
      <Box p={[4.3, 3, 48]} s={[0.5, 6, 15]} c={C.navy} solid />
      <Box p={[-8, 3, 48]} s={[7.4, 6, 15]} c="#526f79" solid />
      <Box p={[8, 3, 48]} s={[7.4, 6, 15]} c="#526f79" solid />
      <Lasers />
      <Box p={[0, 0.9, 55.7]} s={[7.8, 0.6, 2.4]} c="#aabbb1" solid />
      <Box p={[0, 1.24, 55.7]} s={[7.5, 0.07, 2.1]} c={C.purple} />
      <Sign p={[0, 1.5, 54.45]} text="LOW CLEARANCE / SAFE RESTORE" w={4} />
      <Sign
        p={[0, 4, 42]}
        text="LASER ARRAY / AUTO SHRINK"
        w={5}
        color="#ffb2a3"
      />
      <Robot />
      <Gate z={74} open={hp === 0} title="04 / SENTINEL LOCK" />
      <Box p={[0, 0.02, 76]} s={[5, 0.04, 3]} c={C.mint} glow />

      <pointLight
        position={[0, 6, 35]}
        color={C.purple}
        intensity={25}
        distance={15}
      />
      <Ring p={[0, 0.03, 32]} r={2.2} c={C.mint} />
      {[32, 57, 72].map((z, i) => (
        <Sign
          key={z}
          p={[-8, 1.4, z + 1]}
          text={["CREATE", "SENTINEL", "EXIT"][i]}
          w={3}
        />
      ))}
    </>
  );
}
