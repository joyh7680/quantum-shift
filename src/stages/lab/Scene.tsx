import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { useGame } from "../../store";
import { Box, Ball, Ring, Sign, Console } from "../WorldParts";
import { CHIPS } from "./state";
import { CommandChip } from "./CommandChip";
import { electricPhase } from "./gameplay";
import { useDeviceGuide } from "./guideState";
import { DeviceMarker } from "./DeviceMarker";
const cyan = "#59dcff",
  metal = "#26394e",
  dark = "#0b172b";
function ElectricTile({ lane }: { lane: number }) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const phase = electricPhase(useGame.getState().lab.time, lane);
    const material = mesh.current.material as MeshStandardMaterial;
    material.color.set(
      phase === "safe"
        ? "#20726d"
        : phase === "warning"
          ? "#f3b849"
          : "#ac79ff",
    );
    material.emissive.copy(material.color);
    material.emissiveIntensity =
      phase === "live" ? 1.6 : phase === "warning" ? 0.8 : 0.15;
  });
  return (
    <group>
      <mesh ref={mesh} position={[8, 0.025, lane * 2 + 0.5]}>
        <boxGeometry args={[3.7, 0.045, 1.2]} />
        <meshStandardMaterial />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          p={[6.5 + i * 0.75, 0.06, lane * 2 + 0.5]}
          s={[0.025, 0.02, 1.1]}
          c={cyan}
        />
      ))}
    </group>
  );
}
function Battery() {
  const state = useGame((s) => s.lab.battery);
  const highlighted = useDeviceGuide((s) => s.active === "battery");
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const s = useGame.getState();
    if (state === "carried")
      ref.current.position.set(
        s.pos[0] + Math.sin(s.yaw) * 1.25,
        s.pos[1] + 1.7,
        s.pos[2] + Math.cos(s.yaw) * 1.25,
      );
    else if (state === "installed") ref.current.position.set(4.8, 0.2, 19);
    else ref.current.position.set(-4, 0.1, 18);
  });
  return (
    <group ref={ref}>
      <Box
        p={[0, 0.65, 0]}
        s={[1.5, 1.3, 1.1]}
        c={highlighted ? cyan : "#6d829b"}
        glow={highlighted}
      />
      {highlighted && (
        <DeviceMarker
          device="battery"
          position={[0, 0.75, 0]}
          size={[1.85, 1.8, 1.45]}
        />
      )}
      <Box p={[0, 1.37, 0]} s={[0.65, 0.15, 0.6]} c="#ffcb80" />
      {[-0.45, 0, 0.45].map((x) => (
        <Box
          key={x}
          p={[x, 0.65, -0.56]}
          s={[0.18, 0.85, 0.04]}
          c="#ffcb80"
          glow
        />
      ))}
      <Sign
        p={[0, 1.9, -0.6]}
        text={state === "installed" ? "CELL CONNECTED" : "HEAVY / 250 kg"}
        w={2.2}
        color="#ffcb80"
      />
    </group>
  );
}
function Fan() {
  const highlighted = useDeviceGuide((s) => s.active === "vent");
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current)
      ref.current.rotation.z += dt * 7 * useGame.getState().lab.fan;
  });
  const open = useGame(
    (s) =>
      s.lab.run === "running" &&
      s.lab.code[s.lab.index] === "vent" &&
      s.lab.power &&
      s.lab.fan === 0 &&
      s.size === 0.25,
  );
  return (
    <>
      <Box p={[-6.5, 4, 27]} s={[11, 8, 0.8]} c={metal} solid />
      <Box p={[6.5, 4, 27]} s={[11, 8, 0.8]} c={metal} solid />
      <Box p={[0, 4.35, 27]} s={[2, 7.3, 0.8]} c={metal} solid />
      {!open && <Box p={[0, 0.34, 27]} s={[2, 0.68, 0.18]} c="#1e3f55" solid />}
      <Ring p={[0, 0.34, 26.5]} r={0.45} c={cyan} rotation={[0, 0, 0]} />
      {highlighted && (
        <DeviceMarker
          device="vent"
          position={[0, 0.4, 26.55]}
          size={[2.15, 0.95, 0.55]}
        />
      )}
      <group ref={ref} position={[0, 0.34, 26.6]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <Box
              p={[0.19, 0.07, 0]}
              s={[0.39, 0.16, 0.08]}
              c={highlighted ? cyan : "#6f9bb4"}
              glow={highlighted}
            />
          </group>
        ))}
      </group>
      <Sign p={[0, 2, 26.55]} text="MAINTENANCE / VENT" w={4} color={cyan} />
      <Box p={[0, 0.01, 28.5]} s={[1.6, 0.02, 3]} c={cyan} glow />
    </>
  );
}
function PrecisionLever() {
  const highlighted = useDeviceGuide((s) => s.active === "power");
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const s = useGame.getState();
    const operating =
      s.lab.run === "running" &&
      s.lab.code[s.lab.index] === "power" &&
      s.lab.step >= 3;
    ref.current.rotation.x = s.lab.power
      ? -0.55
      : operating
        ? -Math.min(0.55, s.lab.elapsed * 0.8)
        : 0.3;
  });
  return (
    <group ref={ref} position={[5, 1.65, 23.35]}>
      <Box p={[0, 0.15, 0]} s={[0.1, 0.4, 0.1]} c="#afc3d5" />
      <Ball p={[0, 0.4, 0]} r={0.16} c={highlighted ? cyan : "#bca5ff"} glow />
      {highlighted && (
        <DeviceMarker
          device="power"
          position={[0, 0.4, 0]}
          size={[0.65, 0.65, 0.65]}
        />
      )}
    </group>
  );
}
export function LabScene() {
  const power = useGame((s) => s.lab.power);
  const batteryHighlighted = useDeviceGuide((s) => s.active === "battery");
  return (
    <>
      <color attach="background" args={["#071222"]} />
      <fog attach="fog" args={["#071222", 38, 85]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={["#bbdef8", "#17223d", 1.5]} />
      <directionalLight
        position={[0, 22, -10]}
        intensity={3}
        color="#c2e4ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={40}
        shadow-camera-bottom={-35}
        shadow-camera-far={70}
        shadow-bias={-0.0003}
      />
      <pointLight
        position={[-8, 8, 4]}
        intensity={45}
        color="#8b9eff"
        distance={22}
      />
      <pointLight
        position={[6, 7, 20]}
        intensity={50}
        color={cyan}
        distance={22}
      />
      <Box p={[3.25, -0.4, 10.5]} s={[17.5, 0.8, 41]} c="#16273c" solid />
      <Box p={[-11.25, -0.4, 10.5]} s={[1.5, 0.8, 41]} c="#16273c" solid />
      <Box p={[-8, -0.4, -5.25]} s={[5, 0.8, 9.5]} c="#16273c" solid />
      <Box p={[-8, -0.4, 20]} s={[5, 0.8, 22]} c="#16273c" solid />
      <Box p={[-8, -3.6, 4.25]} s={[5, 0.5, 9.5]} c="#08111e" solid />
      {[-1, 1].map((n) => (
        <group key={n}>
          <Box p={[n * 12, 6, 10.5]} s={[0.4, 12, 41]} c={dark} solid />
          <Box p={[n * 11.74, 0.8, 10.5]} s={[0.08, 0.08, 40]} c={cyan} glow />
          {[-4, 8, 20].map((z) => (
            <group key={z}>
              <Box p={[n * 11.7, 5, z]} s={[0.2, 7, 0.4]} c={metal} />
              <Box p={[n * 11.5, 8.5, z]} s={[0.12, 0.06, 5]} c={cyan} glow />
            </group>
          ))}
        </group>
      ))}
      <Box p={[0, 6, -10]} s={[24, 12, 0.4]} c={dark} solid />
      <Box p={[0, 6, 31]} s={[24, 12, 0.4]} c={dark} solid />
      {[-4, 0, 4].map((x) => (
        <Box key={x} p={[x, 0.015, 10]} s={[0.025, 0.02, 38]} c="#35566e" />
      ))}
      {[-6, -2, 10, 14, 22].map((z) => (
        <Box key={z} p={[0, 0.016, z]} s={[23, 0.025, 0.025]} c="#35566e" />
      ))}
      <Ring p={[0, 0.035, -2]} r={1.8} c={cyan} />
      <Sign
        p={[0, 5, -8]}
        text="QUANTUM / MACRO LABORATORY"
        w={12}
        color={cyan}
      />
      {/* Oversized books form a jump path onto a research desk. */}
      {[
        [-1.6, 0.65],
        [0.5, 1.3],
        [2.6, 1.95],
        [4.7, 2.6],
        [7, 2.8],
      ].map(([z, top], i) => (
        <group key={z}>
          <Box
            p={[-8, top / 2, z]}
            s={[i === 4 ? 4 : 3, top, i === 4 ? 3 : 1.65]}
            c={["#344c79", "#704b70", "#536c80", "#406b75", "#34465e"][i]}
            solid
          />
          <Box
            p={[-8, top - 0.14, z - (i === 4 ? 1.51 : 0.83)]}
            s={[2.7, 0.16, 0.02]}
            c="#c3ccd1"
          />
          <Box
            p={[-8, top + 0.03, z]}
            s={[i === 4 ? 4 : 3, 0.06, i === 4 ? 3 : 1.7]}
            c="#7390a7"
          />
        </group>
      ))}
      <Sign
        p={[-8, 1.8, -3.5]}
        text="책 · 연필 발판 / 점프"
        w={4}
        color="#ffcb80"
      />
      <mesh
        position={[-8, 2.78, 5.9]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.15, 0.15, 3.8, 6]} />
        <meshStandardMaterial color="#f6be59" metalness={0.4} roughness={0.4} />
      </mesh>
      <Box p={[-10.5, 4.7, 7]} s={[1.1, 3.8, 2.8]} c={metal} />
      <Sign
        p={[-8, 5.6, 8]}
        text="MACRO DESK / FIELD NOTES"
        w={4.5}
        color={cyan}
      />
      {/* A ceiling-high workbench makes the character's miniature scale legible. */}
      <Box p={[8, 7.6, 3]} s={[6, 0.45, 15]} c="#52647b" solid />
      {[5.35, 10.65].flatMap((x) =>
        [-3.7, 9.7].map((z) => (
          <Box
            key={`${x}-${z}`}
            p={[x, 3.7, z]}
            s={[0.4, 7.4, 0.4]}
            c={metal}
            solid
          />
        )),
      )}
      <Box p={[8, 7.88, 3]} s={[5.3, 0.05, 13.5]} c="#22455f" />
      <mesh position={[8, 8.14, 3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 11, 6]} />
        <meshStandardMaterial color="#f0bb61" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Emergency electric challenge has high side walls and a back wall. */}
      {[5.9, 10.1].map((x) => (
        <Box key={x} p={[x, 2.7, 3]} s={[0.25, 5.4, 12]} c={metal} solid />
      ))}
      <Box p={[8, 2.7, 9]} s={[4.4, 5.4, 0.25]} c={metal} solid />
      {[0, 1, 2].map((i) => (
        <ElectricTile key={i} lane={i} />
      ))}
      <Sign
        p={[8, 1.8, -2]}
        text="비상 전기 / 청록 안전 · 보라 방전"
        w={4.2}
        color="#bca5ff"
      />
      {[1.5, 3.5, 5.5, 7.5].map((z) => (
        <Box key={z} p={[8, 0.012, z]} s={[3.6, 0.02, 0.12]} c="#4ad9b9" glow />
      ))}
      {/* Separate chip tunnel: 0.65m clearance, enclosed on both sides and rear. */}
      <Box p={[-8, 3.65, 18.7]} s={[4.5, 6, 9.4]} c={metal} solid />
      {[-9.6, -6.4].map((x) => (
        <Box
          key={x}
          p={[x, 0.32, 18.7]}
          s={[1.3, 0.64, 9.4]}
          c="#455a70"
          solid
        />
      ))}
      <Box p={[-8, 0.32, 23.4]} s={[4.5, 0.64, 0.3]} c={metal} solid />
      <Box p={[-8, 0.02, 18.7]} s={[1.7, 0.025, 9.4]} c="#246575" glow />
      <Sign
        p={[-8, 1.6, 13.95]}
        text="분석 장비 / 낮은 통로"
        w={4.2}
        color="#70f2cd"
      />
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          p={[-8, 2.5 + i * 0.8, 13.95]}
          s={[3.7, 0.08, 0.06]}
          c={i === 0 ? cyan : "#526d89"}
          glow={i === 0}
        />
      ))}
      {CHIPS.map((chip) => (
        <CommandChip key={chip.id} id={chip.id} pos={chip.pos} />
      ))}
      <Console p={[0, 0, 10]} title="ESCAPE / BLOCK CODE" color={cyan} />
      <Sign p={[0, 3.2, 10]} text="탈출 콘솔 / E" w={3.8} color={cyan} />
      <Battery />
      <Box
        p={[4.8, 0.1, 19]}
        s={[2.3, 0.2, 2.1]}
        c={batteryHighlighted ? cyan : metal}
        glow={batteryHighlighted}
      />
      <Ring
        p={[4.8, 0.23, 19]}
        r={1.2}
        c={batteryHighlighted || power ? cyan : "#ffcb80"}
      />
      {batteryHighlighted && (
        <DeviceMarker
          device="battery"
          position={[4.8, 0.4, 19]}
          size={[2.75, 0.85, 2.55]}
        />
      )}
      <Sign p={[5.2, 2.8, 19.5]} text="CELL SOCKET" w={3} color="#ffcb80" />
      <Console
        p={[5, 0, 24]}
        title={power ? "MAINTENANCE / ON" : "PRECISION / OFF"}
        color={power ? cyan : "#bca5ff"}
      />
      <PrecisionLever />
      <Box
        p={[3, 0.02, 24]}
        s={[4, 0.03, 0.05]}
        c={power ? cyan : "#526078"}
        glow={power}
      />
      <Box
        p={[1, 0.02, 25.5]}
        s={[0.05, 0.03, 3]}
        c={power ? cyan : "#526078"}
        glow={power}
      />
      <Fan />
      {/* Giant measuring vessels behind the central puzzle aisle. */}
      {[8.5, 10.4].map((x, i) => (
        <group key={x}>
          <Box p={[x, 3.5, 18]} s={[0.35, 7, 0.35]} c="#66849c" />
          <mesh position={[x, 6.4, 18]}>
            <cylinderGeometry args={[0.7, 0.9, 2.4, 24]} />
            <meshStandardMaterial
              color={i ? "#bca5ff" : cyan}
              metalness={0.45}
              roughness={0.28}
              transparent
              opacity={0.6}
            />
          </mesh>
          <Ball p={[x, 5.4, 18]} r={0.65} c={i ? "#bca5ff" : cyan} glow />
        </group>
      ))}
    </>
  );
}
