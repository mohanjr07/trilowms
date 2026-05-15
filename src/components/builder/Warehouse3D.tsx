import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Environment, Stats } from "@react-three/drei";
import * as THREE from "three";
import { warehouse, type Bin, type Rack, type Zone, type Dock, type Forklift } from "@/lib/wms-data";
import { useWMSStore } from "@/lib/wms-store";

const STATUS_COLOR: Record<Bin["status"], string> = {
  Empty: "#3a4452",
  Partial: "#eab308",
  Full: "#16a34a",
  Reserved: "#0ea5e9",
  Blocked: "#dc2626",
  Damaged: "#737373",
};

function Floor() {
  const w = warehouse.size.w;
  const d = warehouse.size.d;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#1f2630" roughness={0.95} metalness={0.05} />
      </mesh>
      <Grid
        args={[w, d]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#2c3543"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3d4a5c"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />
      {/* perimeter walls */}
      {[
        { p: [0, 1, -d / 2] as [number, number, number], s: [w, 2, 0.15] as [number, number, number] },
        { p: [0, 1, d / 2] as [number, number, number], s: [w, 2, 0.15] as [number, number, number] },
        { p: [-w / 2, 1, 0] as [number, number, number], s: [0.15, 2, d] as [number, number, number] },
        { p: [w / 2, 1, 0] as [number, number, number], s: [0.15, 2, d] as [number, number, number] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.p}>
          <boxGeometry args={wall.s} />
          <meshStandardMaterial color="#2a313c" roughness={0.9} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ZoneFloor({ zone }: { zone: Zone }) {
  const { selectedId, viewMode, select, zoneFilter } = useWMSStore();
  const isSelected = selectedId === zone.id;
  const dimmed = zoneFilter && zoneFilter !== zone.id;

  let color = zone.color;
  let opacity = 0.18;
  if (viewMode === "occupancy") {
    const u = zone.utilization;
    color = u > 0.8 ? "#dc2626" : u > 0.6 ? "#eab308" : u > 0.3 ? "#16a34a" : "#0891b2";
    opacity = 0.4;
  } else if (viewMode === "activity" || viewMode === "picking") {
    const a = zone.activity;
    color = a > 0.7 ? "#f97316" : a > 0.4 ? "#eab308" : "#3b82f6";
    opacity = 0.35;
  } else if (viewMode === "congestion") {
    color = zone.activity * zone.utilization > 0.5 ? "#dc2626" : "#16a34a";
    opacity = 0.35;
  }

  return (
    <group>
      <mesh
        position={[zone.bounds.x + zone.bounds.w / 2, 0.02, zone.bounds.z + zone.bounds.d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); select(zone.id, "zone"); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <planeGeometry args={[zone.bounds.w, zone.bounds.d]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={dimmed ? 0.05 : isSelected ? Math.min(opacity + 0.25, 0.7) : opacity}
          emissive={color}
          emissiveIntensity={isSelected ? 0.4 : 0.1}
        />
      </mesh>
      {/* zone border */}
      <lineSegments
        position={[zone.bounds.x + zone.bounds.w / 2, 0.05, zone.bounds.z + zone.bounds.d / 2]}
      >
        <edgesGeometry
          args={[new THREE.PlaneGeometry(zone.bounds.w, zone.bounds.d).rotateX(-Math.PI / 2)]}
        />
        <lineBasicMaterial color={isSelected ? "#fbbf24" : color} linewidth={2} />
      </lineSegments>
      {useWMSStore.getState().showLabels && (
        <Html
          position={[zone.bounds.x + zone.bounds.w / 2, 0.5, zone.bounds.z + 0.3]}
          center
          distanceFactor={20}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none px-2 py-0.5 text-[10px] font-bold tracking-wider text-mono whitespace-nowrap rounded border bg-background/80"
            style={{ color: zone.color, borderColor: zone.color + "60" }}>
            {zone.name.toUpperCase()} · {(zone.utilization * 100).toFixed(0)}%
          </div>
        </Html>
      )}
    </group>
  );
}

function RackMesh({ rack, zoneColor }: { rack: Rack; zoneColor: string }) {
  const { selectedId, select, viewMode } = useWMSStore();
  const [x, z] = rack.position;
  const rackW = 1.6, rackD = 0.6;
  const levelH = 0.45;

  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); select(rack.id, "rack"); }}>
      {/* uprights */}
      {[[-rackW / 2, -rackD / 2], [rackW / 2, -rackD / 2], [-rackW / 2, rackD / 2], [rackW / 2, rackD / 2]].map((p, i) => (
        <mesh key={i} position={[p[0], (rack.levels * levelH) / 2, p[1]]}>
          <boxGeometry args={[0.06, rack.levels * levelH, 0.06]} />
          <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* beams + bins */}
      {Array.from({ length: rack.levels }).map((_, l) => {
        const y = l * levelH + 0.05;
        return (
          <group key={l} position={[0, y, 0]}>
            <mesh position={[0, levelH * 0.95, 0]}>
              <boxGeometry args={[rackW, 0.04, rackD]} />
              <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
            </mesh>
            {Array.from({ length: rack.binsPerLevel }).map((_, p) => {
              const bin = rack.bins[l * rack.binsPerLevel + p];
              if (!bin) return null;
              const binW = rackW / rack.binsPerLevel;
              const bx = -rackW / 2 + binW / 2 + p * binW;
              const occ = bin.occupancy;
              let color = STATUS_COLOR[bin.status];
              if (viewMode === "occupancy") {
                color = occ > 0.8 ? "#dc2626" : occ > 0.5 ? "#eab308" : occ > 0.1 ? "#16a34a" : "#3a4452";
              } else if (viewMode === "picking") {
                color = bin.status === "Full" || bin.status === "Partial" ? "#f97316" : "#374151";
              }
              const isSelected = selectedId === bin.id;
              return (
                <mesh
                  key={bin.id}
                  position={[bx, levelH * 0.45 * Math.max(occ, 0.15), 0]}
                  onClick={(e) => { e.stopPropagation(); select(bin.id, "bin"); }}
                  onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
                  onPointerOut={() => { document.body.style.cursor = "default"; }}
                >
                  <boxGeometry args={[binW * 0.86, levelH * 0.85 * Math.max(occ, 0.15), rackD * 0.8]} />
                  <meshStandardMaterial
                    color={color}
                    emissive={isSelected ? "#fbbf24" : color}
                    emissiveIntensity={isSelected ? 0.6 : bin.status === "Full" ? 0.18 : 0.05}
                    metalness={0.2}
                    roughness={0.7}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {/* zone tint top cap */}
      <mesh position={[0, rack.levels * levelH + 0.04, 0]}>
        <boxGeometry args={[rackW, 0.02, rackD]} />
        <meshStandardMaterial color={zoneColor} emissive={zoneColor} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function DockMesh({ dock }: { dock: Dock }) {
  const { select, selectedId } = useWMSStore();
  const isSelected = selectedId === dock.id;
  const color = dock.kind === "Inbound" ? "#0891b2" : "#f97316";
  const [x, z] = dock.position;
  const isTop = z < 0;
  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); select(dock.id, "dock"); }}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[3.2, 0.1, 1.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 0.6 : 0.25} />
      </mesh>
      {dock.occupied && (
        <group position={[0, 0, isTop ? -2.6 : 2.6]}>
          {/* truck body */}
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[2.6, 1.6, 4]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.2} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.4, isTop ? 1.6 : -1.6]}>
            <boxGeometry args={[2.4, 1, 1.2]} />
            <meshStandardMaterial color="#9ca3af" />
          </mesh>
          {/* status light */}
          <mesh position={[0, 2.4, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
          </mesh>
        </group>
      )}
      <Html position={[0, 0.3, 0]} center distanceFactor={18} zIndexRange={[5, 0]}>
        <div className="pointer-events-none px-1.5 py-0.5 text-[9px] font-bold text-mono rounded border bg-background/80"
          style={{ color, borderColor: color + "60" }}>
          {dock.code}
        </div>
      </Html>
    </group>
  );
}

function ForkliftMesh({ fl }: { fl: Forklift }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current += dt * fl.speed * 0.4;
    const p = t.current % fl.path.length;
    const i = Math.floor(p);
    const frac = p - i;
    const a = fl.path[i];
    const b = fl.path[(i + 1) % fl.path.length];
    const x = a[0] + (b[0] - a[0]) * frac;
    const z = a[1] + (b[1] - a[1]) * frac;
    ref.current.position.set(x, 0, z);
    ref.current.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.8, 1.2]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.1, 0.3]}>
        <boxGeometry args={[0.5, 0.6, 0.4]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

function PathTrails() {
  return (
    <>
      {warehouse.forklifts.map((fl) => {
        const points = fl.path.map((p) => new THREE.Vector3(p[0], 0.05, p[1]));
        points.push(points[0]);
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <line key={fl.id}>
            <primitive object={geo} attach="geometry" />
            <lineDashedMaterial color="#fbbf24" dashSize={0.3} gapSize={0.2} transparent opacity={0.4} />
          </line>
        );
      })}
    </>
  );
}

function Scene() {
  const { showForklifts, showDocks } = useWMSStore();
  const allRacks = useMemo(
    () => warehouse.zones.flatMap((z) => z.aisles.flatMap((a) => a.racks.map((r) => ({ rack: r, color: z.color, zoneId: z.id })))),
    [],
  );
  const filter = useWMSStore((s) => s.zoneFilter);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 20]} intensity={0.8} castShadow />
      <directionalLight position={[-20, 25, -10]} intensity={0.3} color="#22d3ee" />
      <hemisphereLight args={["#3b82f6", "#1f2937", 0.3]} />

      <Floor />
      {warehouse.zones.map((z) => <ZoneFloor key={z.id} zone={z} />)}
      {allRacks.map(({ rack, color, zoneId }) => (
        (!filter || filter === zoneId) && <RackMesh key={rack.id} rack={rack} zoneColor={color} />
      ))}
      {showDocks && warehouse.docks.map((d) => <DockMesh key={d.id} dock={d} />)}
      {showForklifts && (
        <>
          <PathTrails />
          {warehouse.forklifts.map((fl) => <ForkliftMesh key={fl.id} fl={fl} />)}
        </>
      )}
    </>
  );
}

export function Warehouse3D() {
  const select = useWMSStore((s) => s.select);
  return (
    <Canvas
      shadows
      camera={{ position: [35, 28, 35], fov: 45 }}
      onPointerMissed={() => select(null, null)}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#11161e"]} />
      <fog attach="fog" args={["#11161e", 60, 140]} />
      <Scene />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={90}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
