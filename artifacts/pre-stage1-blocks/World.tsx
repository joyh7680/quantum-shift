import { useGame } from "./store";
import { C, Box } from "./stages/WorldParts";
import { LabScene } from "./stages/lab/Scene";
import { CircuitScene } from "./stages/circuit/Scene";
export function World() {
  const stage = useGame((s) => s.activeStage);
  const start = stage === 1 ? -10 : 30;
  const end = stage === 1 ? 31 : 78;
  const length = end - start,
    center = (start + end) / 2;
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

      <Box p={[0, -0.4, center]} s={[24, 0.8, length]} c="#b7cbc5" solid />
      {Array.from({ length: Math.ceil(length / 4) }, (_, i) => (
        <group key={i}>
          <Box
            p={[0, 0.006, start + 2 + i * 4]}
            s={[23.5, 0.012, 0.025]}
            c="#93aea8"
          />
          {[-8, -4, 0, 4, 8].map((x) => (
            <Box
              key={x}
              p={[x, 0.005, start + 2 + i * 4]}
              s={[0.025, 0.01, 4]}
              c="#93aea8"
            />
          ))}
        </group>
      ))}
      <Box p={[-12, 5, center]} s={[0.65, 10, length]} c={C.navy} solid />
      <Box p={[12, 5, center]} s={[0.65, 10, length]} c={C.navy} solid />
      <Box p={[0, 5, start]} s={[24, 10, 0.65]} c={C.navy} solid />
      <Box p={[0, 5, end]} s={[24, 10, 0.65]} c={C.navy} solid />
      {[-1, 1].map((n) => (
        <group key={n}>
          <Box
            p={[n * 11.62, 1.2, center]}
            s={[0.12, 0.12, length - 2]}
            c={C.mint}
            glow
          />
          {(stage === 1 ? [-3, 17] : [35, 60, 73]).map((z) => (
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
      {stage === 1 ? <LabScene /> : <CircuitScene />}
    </>
  );
}
