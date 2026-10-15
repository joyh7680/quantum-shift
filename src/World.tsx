import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, Group, SRGBColorSpace } from "three";
import { useGame } from "./store";
type V = [number, number, number];
const C = {
  navy: "#243e4c",
  white: "#e5ede6",
  mint: "#79e4bd",
  orange: "#ffad65",
  purple: "#b7a3ef",
  dark: "#142c39",
};
export function Box({
  p,
  s,
  c = C.white,
  solid = false,
  glow = false,
  round = 0.09,
}: {
  p: V;
  s: V;
  c?: string;
  solid?: boolean;
  glow?: boolean;
  round?: number;
}) {
  const mesh = (
    <RoundedBox
      position={p}
      args={s}
      radius={Math.min(round, ...s.map((v) => v / 3))}
      smoothness={2}
      castShadow
      receiveShadow
      userData={{ cameraSolid: solid }}
    >
      <meshStandardMaterial
        color={c}
        roughness={0.68}
        metalness={0.08}
        emissive={c}
        emissiveIntensity={glow ? 0.8 : 0}
      />
    </RoundedBox>
  );
  return solid ? (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[s[0] / 2, s[1] / 2, s[2] / 2]} position={p} />
      {mesh}
    </RigidBody>
  ) : (
    mesh
  );
}
function Ball({
  p,
  r,
  c,
  glow = false,
}: {
  p: V;
  r: number;
  c: string;
  glow?: boolean;
}) {
  return (
    <mesh position={p} castShadow>
      <sphereGeometry args={[r, 24, 16]} />
      <meshStandardMaterial
        color={c}
        roughness={0.4}
        metalness={0.18}
        emissive={c}
        emissiveIntensity={glow ? 0.6 : 0}
      />
    </mesh>
  );
}
function Ring({
  p,
  r,
  c,
  rotation = [Math.PI / 2, 0, 0],
}: {
  p: V;
  r: number;
  c: string;
  rotation?: V;
}) {
  return (
    <mesh position={p} rotation={rotation}>
      <torusGeometry args={[r, 0.06, 10, 48]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.7} />
    </mesh>
  );
}
export function Sign({
  p,
  text,
  w = 3,
  color = "#8de9c6",
  background = "#203c49",
}: {
  p: V;
  text: string;
  w?: number;
  color?: string;
  background?: string;
}) {
  const texture = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = 1024;
    el.height = 160;
    const ctx = el.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = color;
    ctx.font = "600 62px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 82, 980);
    const tex = new CanvasTexture(el);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [text, color, background]);
  return (
    <mesh position={p} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[w, w / 6.4]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
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
function Console({ p, title, color }: { p: V; title: string; color: string }) {
  return (
    <group position={p}>
      <Box p={[0, 0.65, 0]} s={[1.6, 1.3, 1.25]} c={C.navy} solid />
      <Box p={[0, 1.5, 0.1]} s={[1.9, 0.8, 0.25]} c={color} />
      <Box p={[0, 1.5, -0.035]} s={[1.65, 0.55, 0.03]} c={C.dark} />
      <Sign p={[0, 1.51, -0.06]} text={title} w={1.5} />
      {[-0.5, 0, 0.5].map((x, i) => (
        <Ball
          key={i}
          p={[x, 1.34, -0.55]}
          r={0.08}
          c={i === 0 ? color : C.white}
          glow
        />
      ))}
      <Ring p={[0, 0.04, 0]} r={1.4} c={color} />
    </group>
  );
}
function Gate({
  z,
  open,
  title,
  color = C.mint,
}: {
  z: number;
  open: boolean;
  title: string;
  color?: string;
}) {
  return (
    <group>
      <Box p={[-7.6, 4, z]} s={[8.8, 8, 0.7]} c={C.navy} solid />
      <Box p={[7.6, 4, z]} s={[8.8, 8, 0.7]} c={C.navy} solid />
      <Box p={[0, 7.4, z]} s={[6.4, 1.2, 0.9]} c={C.navy} solid />
      {[-1, 1].map((n) => (
        <group key={n}>
          <Box p={[n * 3.2, 3.5, z - 0.1]} s={[0.23, 7, 0.95]} c={color} glow />
          {!open && (
            <Box p={[n * 1.5, 3.2, z]} s={[3, 6.4, 0.35]} c="#52736f" solid />
          )}
        </group>
      ))}
      <Sign
        p={[0, 6.9, z - 0.47]}
        text={open ? "ACCESS GRANTED" : title}
        w={5}
      />
    </group>
  );
}
function Battery() {
  const state = useGame((s) => s.battery);
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
export const LASER_Z = [44, 48, 52];
export function laserPosition(base: number, time: number) {
  return base + Math.sin(time * 1.1 + base) * 0.8;
}
function Lasers() {
  const refs = useRef<Group[]>([]);
  useFrame(() => {
    const t = useGame.getState().time;
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
  const phase = useGame((s) => s.bossPhase);
  const hp = useGame((s) => s.bossHP);
  useFrame(() => {
    const s = useGame.getState();
    if (root.current) {
      root.current.position.y = hp === 0 ? -0.5 : Math.sin(s.time * 1.8) * 0.12;
      root.current.rotation.z = hp === 0 ? 0.25 : Math.sin(s.time) * 0.025;
    }
    if (beam.current) {
      beam.current.visible = s.bossPhase === "fire";
      beam.current.position.z = 60 + ((s.bossTime % 9) - 2) * 4;
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
export function World() {
  const power = useGame((s) => s.power),
    equipped = useGame((s) => s.equipped),
    hp = useGame((s) => s.bossHP);
  return (
    <>
      <color attach="background" args={["#bbcfc8"]} />
      <fog attach="fog" args={["#bbcfc8", 40, 110]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#f4fff4", "#708b9e", 1.4]} />
      <directionalLight
        position={[-12, 25, -5]}
        intensity={2.7}
        color="#fff1d5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={50}
        shadow-camera-bottom={-45}
        shadow-camera-far={100}
        shadow-bias={-0.00025}
      />
      <Box p={[0, -0.4, 34]} s={[24, 0.8, 88]} c="#b7cbc5" solid />
      {Array.from({ length: 22 }, (_, i) => (
        <group key={i}>
          <Box
            p={[0, 0.006, -8 + i * 4]}
            s={[23.5, 0.012, 0.025]}
            c="#93aea8"
          />
          {[-8, -4, 0, 4, 8].map((x) => (
            <Box
              key={x}
              p={[x, 0.005, -6 + i * 4]}
              s={[0.025, 0.01, 4]}
              c="#93aea8"
            />
          ))}
        </group>
      ))}
      <Box p={[-12, 5, 34]} s={[0.65, 10, 89]} c={C.navy} solid />
      <Box p={[12, 5, 34]} s={[0.65, 10, 89]} c={C.navy} solid />
      <Box p={[0, 5, -10]} s={[24, 10, 0.65]} c={C.navy} solid />
      <Box p={[0, 5, 78]} s={[24, 10, 0.65]} c={C.navy} solid />
      {[-1, 1].map((n) => (
        <group key={n}>
          <Box p={[n * 11.62, 1.2, 33]} s={[0.12, 0.12, 85]} c={C.mint} glow />
          {[-3, 17, 35, 60, 73].map((z) => (
            <group key={z}>
              <Box p={[n * 11.5, 5, z]} s={[0.18, 5.4, 7]} c="#506f78" />
              <Box
                p={[n * 11.35, 7.5, z]}
                s={[0.16, 0.15, 7]}
                c={C.mint}
                glow
              />
            </group>
          ))}
        </group>
      ))}
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
      {power && (
        <>
          <pointLight
            position={[0, 6, 23]}
            color={C.mint}
            intensity={35}
            distance={18}
          />
          <pointLight
            position={[0, 6, 35]}
            color={C.purple}
            intensity={25}
            distance={15}
          />
        </>
      )}
      <Ring p={[0, 0.03, -2]} r={2.2} c={C.mint} />
      {[-2, 14, 32, 57, 72].map((z, i) => (
        <group key={z}>
          <Box p={[0, 0.012, z]} s={[0.08, 0.02, 1]} c={C.orange} />
          <Sign
            p={[-8, 1.4, z + 1]}
            text={["EXPLORE", "ENERGY", "CREATE", "SENTINEL", "EXIT"][i]}
            w={3}
          />
        </group>
      ))}
    </>
  );
}
