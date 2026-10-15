import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
type V = [number, number, number];
export const C = {
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
export function Ball({
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
export function Ring({
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
export function Console({
  p,
  title,
  color,
}: {
  p: V;
  title: string;
  color: string;
}) {
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
export function Gate({
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
