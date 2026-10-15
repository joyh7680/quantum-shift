import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useGame } from "../../store";
import { C, Box, Ball, Ring, Sign, Console, Gate } from "../WorldParts";
function Bench({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <Box p={[x, 4.8, z]} s={[5.5, 0.45, 5]} c="#b4c7c2" solid />
      {[-2, 2].flatMap((dx) =>
        [-1.8, 1.8].map((dz) => (
          <Box
            key={`${dx}${dz}`}
            p={[x + dx, 2.25, z + dz]}
            s={[0.4, 4.5, 0.4]}
            c={C.navy}
            solid
          />
        )),
      )}
      <Box p={[x, 5.2, z]} s={[2.7, 0.4, 2.5]} c={C.purple} />
      <Box p={[x + 0.15, 5.6, z]} s={[2.6, 0.35, 2.4]} c={C.orange} />
      <mesh position={[x - 1.5, 5.5, z - 1]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.27, 0.5, 1, 24]} />
        <meshStandardMaterial color={C.mint} />
      </mesh>
      <mesh
        position={[x + 1.8, 5.3, z]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.12, 0.12, 4, 6]} />
        <meshStandardMaterial color="#ffcb6a" />
      </mesh>
      <Sign p={[x, 4.6, z - 2.53]} text="MACRO / RESEARCH" w={4} />
    </group>
  );
}
function Battery() {
  const state = useGame((s) => s.lab.battery);
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current && state === "carried") {
      const s = useGame.getState();
      ref.current.position.set(
        s.pos[0] + Math.sin(s.yaw) * 2,
        s.pos[1] + 1,
        s.pos[2] + Math.cos(s.yaw) * 2,
      );
    }
  });
  return (
    <group
      ref={ref}
      position={state === "installed" ? [4, 0.2, 21] : [-5, 0.2, 18]}
    >
      <Box
        p={[0, 0.6, 0]}
        s={[1.5, 1.2, 1]}
        c={C.orange}
        solid={state === "floor"}
      />
      <Box p={[0, 1.27, 0]} s={[0.65, 0.15, 0.6]} c={C.navy} />
      {[-0.45, 0, 0.45].map((x) => (
        <Box
          key={x}
          p={[x, 0.6, -0.51]}
          s={[0.2, 0.65, 0.025]}
          c={C.mint}
          glow
        />
      ))}
      {state === "floor" && <Sign p={[0, 1.7, -0.05]} text="HEAVY / E" w={2} />}
    </group>
  );
}

export function LabScene() {
  const power = useGame((s) => s.lab.power);
  return (
    <>
      <Bench x={-7} z={1} />
      <Bench x={7} z={3} />
      <Sign p={[0, 5.5, 8.38]} text="01 / THE GIANT'S LAB" w={7} />
      <Box p={[-6.35, 4.5, 10]} s={[11.3, 9, 3]} c={C.navy} solid />
      <Box p={[6.35, 4.5, 10]} s={[11.3, 9, 3]} c={C.navy} solid />
      <Box p={[0, 4.81, 10]} s={[1.4, 8.38, 3]} c="#708e91" solid />
      <Box p={[-0.78, 0.4, 8.4]} s={[0.15, 0.8, 0.15]} c={C.orange} />
      <Box p={[0.78, 0.4, 8.4]} s={[0.15, 0.8, 0.15]} c={C.orange} />
      <Sign p={[0, 1.1, 8.35]} text="VENT / 0.25x" w={2.6} color="#ffbd7e" />
      {[8.8, 9.6, 10.4, 11.2].map((z) => (
        <Box key={z} p={[0, 0.6, z]} s={[1.4, 0.03, 0.07]} c={C.mint} />
      ))}
      <Battery />
      <Box p={[4, 0.13, 21]} s={[2.6, 0.26, 2.5]} c={C.navy} />
      <Ring p={[4, 0.28, 21]} r={1.1} c={power ? C.mint : C.orange} />
      <Sign p={[4, 2.4, 21.5]} text="POWER CELL / E" w={3} />
      <Console p={[4, 0, 25]} title="POWER / SEQUENCE" color={C.orange} />
      <Box p={[-8, 2, 23]} s={[4, 4, 5]} c="#67858a" solid />
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Box
            p={[-8, 1 + i, 20.45]}
            s={[3, 0.12, 0.05]}
            c={power ? C.mint : C.dark}
            glow={power}
          />
          <Ring p={[-8, 4.1, 22 + i]} r={0.6} c={C.mint} />
        </group>
      ))}
      <Gate z={30} open={power} title="02 / POWER REQUIRED" />

      {power && (
        <pointLight
          position={[0, 6, 23]}
          color={C.mint}
          intensity={35}
          distance={18}
        />
      )}
      <Ring p={[0, 0.03, -2]} r={2.2} c={C.mint} />
      {[-2, 14].map((z, i) => (
        <Sign
          key={z}
          p={[-8, 1.4, z + 1]}
          text={["EXPLORE", "ENERGY"][i]}
          w={3}
        />
      ))}
    </>
  );
}
