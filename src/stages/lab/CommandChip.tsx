import { useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Group, Shape } from "three";
import { useGame } from "../../store";
import { COMMANDS } from "./state";
import type { Chip } from "./state";
import type { Vec } from "../shared";
import { TutorialBatteryBeacon } from "./Tutorial";

const shell = "#14263b";
const alloy = "#65819b";
const lightning = new Shape();
lightning.moveTo(0.035, 0.15);
lightning.lineTo(-0.085, -0.015);
lightning.lineTo(-0.012, -0.015);
lightning.lineTo(-0.04, -0.15);
lightning.lineTo(0.09, 0.035);
lightning.lineTo(0.015, 0.035);
lightning.closePath();

const blade = new Shape();
blade.moveTo(0.035, 0.035);
blade.bezierCurveTo(0.04, 0.125, 0.115, 0.215, 0.185, 0.125);
blade.bezierCurveTo(0.215, 0.055, 0.12, 0.015, 0.035, 0.035);

function Casing({
  position = [0, 0, 0],
  size,
  color = shell,
  lit = false,
}: {
  position?: Vec;
  size: Vec;
  color?: string;
  lit?: boolean;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={Math.min(0.045, ...size.map((n) => n / 3))}
      smoothness={3}
      castShadow
    >
      <meshStandardMaterial
        color={color}
        metalness={lit ? 0.3 : 0.72}
        roughness={lit ? 0.25 : 0.3}
        emissive={color}
        emissiveIntensity={lit ? 1.15 : 0}
      />
    </RoundedBox>
  );
}

function LightRing({
  radius,
  color,
  tube = 0.014,
  arc = Math.PI * 2,
}: {
  radius: number;
  color: string;
  tube?: number;
  arc?: number;
}) {
  return (
    <mesh>
      <torusGeometry args={[radius, tube, 8, 48, arc]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.25}
        metalness={0.3}
        roughness={0.25}
      />
    </mesh>
  );
}

function BatteryCell({ color }: { color: string }) {
  return (
    <group>
      <Casing size={[0.4, 0.62, 0.25]} />
      <Casing position={[0, 0.34, 0]} size={[0.16, 0.09, 0.15]} color={alloy} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Casing
            position={[side * 0.205, 0, 0]}
            size={[0.035, 0.43, 0.17]}
            color={color}
            lit
          />
          <Casing
            position={[0, side * 0.265, 0]}
            size={[0.45, 0.065, 0.29]}
            color={alloy}
          />
          <group rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
            <Casing
              position={[0, 0.045, 0.135]}
              size={[0.3, 0.35, 0.025]}
              color="#091321"
            />
            <mesh position={[0, 0.045, 0.155]}>
              <extrudeGeometry
                args={[lightning, { depth: 0.012, bevelEnabled: false }]}
              />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.5}
              />
            </mesh>
            {[-1, 0, 1].map((i) => (
              <Casing
                key={i}
                position={[i * 0.09, -0.2, 0.15]}
                size={[0.06, 0.04, 0.025]}
                color={color}
                lit
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function PowerCore({ color }: { color: string }) {
  const rotor = useRef<Group>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z -= dt * 0.35;
  });
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.29, 0.29, 0.19, 48]} />
        <meshStandardMaterial color={shell} metalness={0.8} roughness={0.27} />
      </mesh>
      <group ref={rotor}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <group rotation={[0, 0, 0.16]}>
              <LightRing radius={0.34} color={color} tube={0.012} arc={1.65} />
            </group>
            <Casing
              position={[0.34, 0, 0]}
              size={[0.065, 0.045, 0.12]}
              color={alloy}
            />
          </group>
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <mesh position={[0, 0, 0.105]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.245, 0.245, 0.025, 48]} />
            <meshStandardMaterial
              color="#0a1425"
              metalness={0.55}
              roughness={0.22}
            />
          </mesh>
          <group position={[0, 0, 0.13]} rotation={[0, 0, Math.PI * 0.75]}>
            <LightRing
              radius={0.145}
              color={color}
              tube={0.023}
              arc={Math.PI * 1.5}
            />
          </group>
          <Casing
            position={[0, 0.13, 0.13]}
            size={[0.044, 0.19, 0.04]}
            color={color}
            lit
          />
          <Casing
            position={[0, -0.215, 0.125]}
            size={[0.055, 0.016, 0.02]}
            color="#dce8ff"
            lit
          />
        </group>
      ))}
    </group>
  );
}

function VentTurbine({ color }: { color: string }) {
  const rotor = useRef<Group>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += dt * 1.8;
  });
  return (
    <group>
      {/* Open frame and a real rotor keep the fan silhouette visible from both sides. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Casing position={[side * 0.245, 0, 0]} size={[0.055, 0.44, 0.14]} />
          <Casing position={[0, side * 0.205, 0]} size={[0.54, 0.055, 0.14]} />
          <Casing
            position={[side * 0.25, 0, -0.075]}
            size={[0.016, 0.25, 0.018]}
            color={color}
            lit
          />
          <Casing
            position={[side * 0.25, 0, 0.075]}
            size={[0.016, 0.25, 0.018]}
            color={color}
            lit
          />
          {[-1, 1].map((y) => (
            <mesh key={y} position={[side * 0.237, y * 0.2, -0.077]}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshStandardMaterial
                color={alloy}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
          ))}
        </group>
      ))}
      <LightRing radius={0.204} color={color} tube={0.012} />
      <group ref={rotor}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            rotation={[0, 0, (i * Math.PI) / 2]}
            position={[0, 0, -0.018]}
            castShadow
          >
            <extrudeGeometry
              args={[
                blade,
                { depth: 0.036, bevelEnabled: false, curveSegments: 12 },
              ]}
            />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.32}
              metalness={0.65}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.1, 24]} />
        <meshStandardMaterial color={alloy} metalness={0.8} roughness={0.22} />
      </mesh>
    </group>
  );
}

export function CommandChipModel({ id }: { id: Chip }) {
  const color = COMMANDS[id].color;
  return (
    <group userData={{ commandChipModel: id }}>
      {id === "battery" ? (
        <BatteryCell color={color} />
      ) : id === "power" ? (
        <PowerCore color={color} />
      ) : (
        <VentTurbine color={color} />
      )}
      <pointLight color={color} intensity={0.65} distance={1.7} />
    </group>
  );
}

export function CommandChip({ id, pos }: { id: Chip; pos: Vec }) {
  const ref = useRef<Group>(null);
  const collected = useGame((s) => s.lab.chips.includes(id));
  const tutorial = useGame(
    (s) =>
      id === "battery" &&
      s.screen === "game" &&
      s.activeStage === 1 &&
      !s.panel &&
      s.labTutorial.step === 3 &&
      s.labTutorial.phase === "active",
  );
  const elapsed = useRef(0);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    if (collected) {
      elapsed.current = Math.min(0.5, elapsed.current + dt);
      ref.current.position.y = pos[1] + elapsed.current * 3;
      ref.current.scale.setScalar(Math.max(0, 1 - elapsed.current * 2));
      ref.current.visible = elapsed.current < 0.5;
    } else {
      elapsed.current = 0;
      ref.current.visible = true;
      ref.current.scale.setScalar(1);
      // The vent collectible must stay inside the 0.65 m maintenance tunnel.
      ref.current.position.y =
        pos[1] +
        Math.sin(clock.elapsedTime * 2) * (id === "vent" ? 0.018 : 0.055);
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.65) * 0.35;
    }
  });
  return (
    <group ref={ref} position={pos} userData={{ commandChip: id }}>
      <CommandChipModel id={id} />
      {tutorial && !collected && <TutorialBatteryBeacon />}
    </group>
  );
}
