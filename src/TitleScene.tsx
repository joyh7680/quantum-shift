import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { ACESFilmicToneMapping, AdditiveBlending, Group } from "three";
import { Character } from "./Character";

function City() {
  return (
    <group>
      {Array.from({ length: 42 }, (_, i) => {
        const x = ((i % 14) - 6.5) * 3.7;
        const z = -24 - Math.floor(i / 14) * 8;
        const height = 3 + ((i * 17) % 13);
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[2.1, height, 2.4]} />
              <meshStandardMaterial
                color="#111d37"
                metalness={0.75}
                roughness={0.34}
              />
            </mesh>
            <mesh position={[0.8, height / 2, 1.22]}>
              <boxGeometry args={[0.035, height * 0.9, 0.02]} />
              <meshBasicMaterial color={i % 3 ? "#248ca6" : "#7651ba"} />
            </mesh>
            {Array.from({ length: Math.floor(height / 1.2) }, (_, j) => (
              <mesh key={j} position={[-0.25, 0.8 + j * 1.2, 1.22]}>
                <boxGeometry args={[1.1, 0.045, 0.02]} />
                <meshBasicMaterial color={i % 4 ? "#265675" : "#64539c"} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* The research reactor and skyline are built entirely from geometry. */}
      <group position={[3, 0, -17]}>
        <mesh position={[0, 2.8, 0]}>
          <cylinderGeometry args={[4.2, 5.6, 5.6, 8]} />
          <meshStandardMaterial
            color="#18243d"
            metalness={0.85}
            roughness={0.28}
          />
        </mesh>
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[1.9, 3.2, 10, 8]} />
          <meshStandardMaterial
            color="#263451"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        {[4, 7, 10, 12].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[y === 4 ? 4.5 : 3.1 - y * 0.07, 0.055, 8, 64]}
            />
            <meshBasicMaterial color={y === 10 ? "#a26aff" : "#4bd8ef"} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 4.4, 5.5, 0]}>
            <boxGeometry args={[0.8, 11, 1.2]} />
            <meshStandardMaterial
              color="#294267"
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Energy({ still }: { still: boolean }) {
  const rings = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!rings.current || still) return;
    rings.current.rotation.y = clock.elapsedTime * 0.12;
    rings.current.position.y = Math.sin(clock.elapsedTime * 0.65) * 0.07;
  });
  return (
    <group ref={rings} position={[1.4, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          position={[0, 1.8, -0.3]}
          rotation={[0.15 + i * 0.1, i * 0.45, i * 0.65]}
        >
          <mesh>
            <torusGeometry
              args={[2.6 + i * 0.16, 0.016, 8, 128, Math.PI * 1.65]}
            />
            <meshBasicMaterial
              color={i === 1 ? "#ae72ff" : "#69eaff"}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <torusGeometry
              args={[2.6 + i * 0.16, 0.09, 8, 128, Math.PI * 1.65]}
            />
            <meshBasicMaterial
              color={i === 1 ? "#9c48ff" : "#2acbff"}
              transparent
              opacity={0.09}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({ id, still }: { id: string; still: boolean }) {
  useFrame(({ camera, clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    camera.position.set(
      3.5 + Math.sin(t * 0.12) * 0.35,
      3.3 + Math.sin(t * 0.16) * 0.12,
      11.5,
    );
    const compact = window.innerWidth <= 760;
    camera.lookAt(compact ? 0.6 : -0.6, compact ? 2.5 : 2.2, 0);
  });
  return (
    <>
      <color attach="background" args={["#070d20"]} />
      <fog attach="fog" args={["#0a1229", 14, 65]} />
      <ambientLight intensity={0.8} color="#92a7df" />
      <directionalLight position={[0, 7, 6]} intensity={3.2} color="#d9e7ff" />
      <directionalLight position={[-5, 4, -2]} intensity={4} color="#9e6fff" />
      <pointLight
        position={[5, 3, 2]}
        intensity={28}
        color="#50e4ff"
        distance={18}
      />
      <pointLight
        position={[1.4, 0.8, 1]}
        intensity={7}
        color="#68efff"
        distance={6}
      />
      <City />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial
          color="#0c172b"
          metalness={0.7}
          roughness={0.32}
        />
      </mesh>
      <gridHelper
        args={[100, 70, "#18324d", "#142238"]}
        position={[0, -0.25, 0]}
      />
      <group position={[1.4, -0.04, 0]}>
        <mesh>
          <cylinderGeometry args={[2.5, 2.7, 0.35, 64]} />
          <meshStandardMaterial
            color="#24324b"
            metalness={0.95}
            roughness={0.26}
          />
        </mesh>
        {[1.8, 2.45, 2.8].map((r) => (
          <mesh
            key={r}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.185, 0]}
          >
            <ringGeometry args={[r, r + 0.024, 96]} />
            <meshBasicMaterial
              color="#53dfff"
              toneMapped={false}
              transparent
              opacity={0.7}
            />
          </mesh>
        ))}
      </group>
      <Suspense fallback={null}>
        <group position={[1.4, 0.15, 0]} rotation={[0, -0.12, 0]} scale={2.6}>
          <Character id={id} />
        </group>
      </Suspense>
      <Energy still={still} />
      <Sparkles
        count={90}
        scale={[22, 12, 14]}
        position={[0, 4, -2]}
        size={2.5}
        speed={still ? 0 : 0.22}
        color="#75d9ff"
        opacity={0.5}
      />
      <Sparkles
        count={35}
        scale={[6, 5, 5]}
        position={[1.4, 2, 0]}
        size={3}
        speed={still ? 0 : 0.35}
        color="#bc8aff"
        opacity={0.6}
      />
    </>
  );
}

export function TitleScene({ id }: { id: string }) {
  const [still, setStill] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div className="title-scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [3.5, 3.3, 11.5], fov: 43 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <Scene id={id} still={still} />
      </Canvas>
    </div>
  );
}
