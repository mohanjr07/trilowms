import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Environment, Stats } from "@react-three/drei";
import * as THREE from "three";
import type { Bin, Rack, Zone, Dock, Forklift } from "@/lib/wms-data";
import { useWMSStore } from "@/lib/wms-store";
import { useEditorStore } from "@/lib/wms-editor-store";

const STATUS_COLOR: Record<Bin["status"], string> = {
  Empty: "#3a4452",
  Partial: "#eab308",
  Full: "#16a34a",
  Reserved: "#0ea5e9",
  Blocked: "#dc2626",
  Damaged: "#737373",
};

function useActiveWarehouse() {
  return useEditorStore((s) => s.warehouses.find((w) => w.name === s.activeId) ?? s.warehouses[0]);
}

function Floor() {
  const { size } = useActiveWarehouse();
  const w = size.w;
  const d = size.d;
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

// Level height for the racking frame. Bumped from 0.45 to 0.6 (levels=4 →
// 2.4 total height) both so the structure reads as real pallet racking at a
// human/MHE scale, and so it stays clearly taller than the forklift model
// (ForkliftMesh tops out at 2.0 with its mast raised) instead of the two
// being nearly the same height.
const RACK_LEVEL_H = 0.6;
const RACK_FRAME_COLOR = "#ea580c"; // safety-orange upright color used on real selective racking
const RACK_BEAM_COLOR = "#334155";

function RackMesh({ rack, zoneColor }: { rack: Rack; zoneColor: string }) {
  const { selectedId, select, viewMode } = useWMSStore();
  const [x, z] = rack.position;
  const rackW = 1.6, rackD = 0.6;
  const levelH = RACK_LEVEL_H;
  const totalH = rack.levels * levelH;
  const corners: [number, number][] = [[-rackW / 2, -rackD / 2], [rackW / 2, -rackD / 2], [-rackW / 2, rackD / 2], [rackW / 2, rackD / 2]];

  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); select(rack.id, "rack"); }}>
      {/* footplates anchoring each upright to the floor */}
      {corners.map((p, i) => (
        <mesh key={`fp-${i}`} position={[p[0], 0.015, p[1]]}>
          <boxGeometry args={[0.16, 0.03, 0.16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* uprights — taller, safety-orange selective-racking frame */}
      {corners.map((p, i) => (
        <mesh key={i} position={[p[0], totalH / 2, p[1]]}>
          <boxGeometry args={[0.07, totalH, 0.07]} />
          <meshStandardMaterial color={RACK_FRAME_COLOR} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {/* diagonal cross-bracing on the back frame, per level — the structural
          detail that reads visually as "real racking" rather than a stack of
          shelves */}
      {Array.from({ length: rack.levels }).map((_, l) => {
        const y0 = l * levelH, y1 = (l + 1) * levelH;
        const len = Math.hypot(rackW - 0.07, y1 - y0);
        const angle = Math.atan2(y1 - y0, rackW - 0.07);
        return (
          <group key={`brace-${l}`} position={[0, (y0 + y1) / 2, -rackD / 2]}>
            <mesh rotation={[0, 0, angle]}>
              <boxGeometry args={[len * 0.96, 0.025, 0.025]} />
              <meshStandardMaterial color={RACK_FRAME_COLOR} metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh rotation={[0, 0, -angle]}>
              <boxGeometry args={[len * 0.96, 0.025, 0.025]} />
              <meshStandardMaterial color={RACK_FRAME_COLOR} metalness={0.4} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* beams + palletized loads */}
      {Array.from({ length: rack.levels }).map((_, l) => {
        const y = l * levelH + 0.05;
        return (
          <group key={l} position={[0, y, 0]}>
            {/* front + back load beams (real racking carries the pallet on two
                beams, not a solid shelf) */}
            {[-rackD / 2, rackD / 2].map((bz, bi) => (
              <mesh key={bi} position={[0, levelH * 0.9, bz]}>
                <boxGeometry args={[rackW, 0.06, 0.06]} />
                <meshStandardMaterial color={RACK_BEAM_COLOR} metalness={0.5} roughness={0.5} />
              </mesh>
            ))}
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
              const loadH = levelH * 0.6 * Math.max(occ, 0.15);
              return (
                <group
                  key={bin.id}
                  position={[bx, levelH * 0.94, 0]}
                  onClick={(e) => { e.stopPropagation(); select(bin.id, "bin"); }}
                  onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
                  onPointerOut={() => { document.body.style.cursor = "default"; }}
                >
                  {/* pallet deck */}
                  <mesh position={[0, 0.025, 0]}>
                    <boxGeometry args={[binW * 0.82, 0.05, rackD * 0.78]} />
                    <meshStandardMaterial color="#92600f" roughness={0.9} />
                  </mesh>
                  {/* carton/load stack on top of the pallet */}
                  <mesh position={[0, 0.05 + loadH / 2, 0]}>
                    <boxGeometry args={[binW * 0.7, loadH, rackD * 0.62]} />
                    <meshStandardMaterial
                      color={color}
                      emissive={isSelected ? "#fbbf24" : color}
                      emissiveIntensity={isSelected ? 0.6 : bin.status === "Full" ? 0.18 : 0.05}
                      metalness={0.2}
                      roughness={0.7}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
      {/* zone tint top cap */}
      <mesh position={[0, totalH + 0.04, 0]}>
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
  // dir: which way the yard/apron side faces from the building wall — same
  // sign convention as the truck's original offset (-2.6 for isTop, +2.6
  // otherwise), so the wall/door/canopy below stay consistently on the
  // opposite side from the parked truck.
  const dir = isTop ? -1 : 1;
  const wallZ = -dir * 0.75;

  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); select(dock.id, "dock"); }}>
      {/* apron pad */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[3.2, 0.04, 1.6]} />
        <meshStandardMaterial color="#20262f" roughness={0.95} />
      </mesh>
      {/* hazard chevron stripes painted on the apron approach */}
      {[-1.1, -0.55, 0, 0.55, 1.1].map((cx, i) => (
        <mesh key={`stripe-${i}`} position={[cx, 0.045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.16, 2.1]} />
          <meshStandardMaterial color={color} transparent opacity={0.3} />
        </mesh>
      ))}
      {/* building wall face the dock is set into */}
      <mesh position={[0, 1.2, wallZ]}>
        <boxGeometry args={[3.2, 2.4, 0.12]} />
        <meshStandardMaterial color="#2a313c" roughness={0.9} />
      </mesh>
      {/* roll-up dock door, recessed into the wall */}
      <mesh position={[0, 1.1, wallZ + dir * 0.07]}>
        <boxGeometry args={[2.3, 1.9, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 0.55 : 0.2} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* door slat lines */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`slat-${i}`} position={[0, 0.3 + i * 0.38, wallZ + dir * 0.1]}>
          <boxGeometry args={[2.25, 0.03, 0.02]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
      {/* canopy over the door */}
      <mesh position={[0, 2.28, wallZ + dir * 0.32]}>
        <boxGeometry args={[2.6, 0.08, 0.6]} />
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* rubber dock bumpers either side of the door */}
      {[-1.3, 1.3].map((bx, i) => (
        <mesh key={`bump-${i}`} position={[bx, 0.25, wallZ + dir * 0.15]}>
          <boxGeometry args={[0.18, 0.4, 0.15]} />
          <meshStandardMaterial color="#111827" roughness={0.9} />
        </mesh>
      ))}
      {/* dock leveler plate bridging to the trailer bed */}
      <mesh position={[0, 0.055, wallZ + dir * 0.42]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, 0.5]} />
        <meshStandardMaterial color="#4b5563" metalness={0.4} roughness={0.5} />
      </mesh>
      {dock.occupied && (
        <group position={[0, 0, isTop ? -2.6 : 2.6]}>
          {/* trailer body */}
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[2.6, 1.6, 4]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.2} roughness={0.6} />
          </mesh>
          {/* trailer wheels */}
          {[-1.5, -0.3, 0.9].flatMap((wz, ri) =>
            [-1.15, 1.15].map((wx, ci) => (
              <mesh key={`tw-${ri}-${ci}`} position={[wx, 0.35, wz]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 14]} />
                <meshStandardMaterial color="#111827" roughness={0.85} />
              </mesh>
            )),
          )}
          {/* tractor cab */}
          <mesh position={[0, 1.4, isTop ? 1.6 : -1.6]}>
            <boxGeometry args={[2.4, 1, 1.2]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.2} roughness={0.5} />
          </mesh>
          {/* cab wheels */}
          {[-1.1, 1.1].map((wx, i) => (
            <mesh key={`cw-${i}`} position={[wx, 0.35, isTop ? 1.9 : -1.9]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.3, 14]} />
              <meshStandardMaterial color="#111827" roughness={0.85} />
            </mesh>
          ))}
          {/* status light */}
          <mesh position={[0, 2.4, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
          </mesh>
        </group>
      )}
      <Html position={[0, 2.55, wallZ]} center distanceFactor={18} zIndexRange={[5, 0]}>
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
  // Mast top sits at ~2.0 — deliberately kept below RACK_LEVEL_H * levels
  // (2.4 for a standard 4-level rack) so the forklift always reads as
  // shorter than the racking it drives between, not the other way round.
  return (
    <group ref={ref}>
      {/* chassis */}
      <mesh position={[0, 0.3, -0.05]}>
        <boxGeometry args={[0.7, 0.5, 1.15]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.25} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* wheels */}
      {([[-0.32, 0.42], [0.32, 0.42], [-0.32, -0.45], [0.32, -0.45]] as [number, number][]).map((p, i) => (
        <mesh key={`wheel-${i}`} position={[p[0], 0.14, p[1]]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.12, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.85} />
        </mesh>
      ))}
      {/* overhead guard posts + roof */}
      {([[-0.28, 0.32], [0.28, 0.32], [-0.28, -0.18], [0.28, -0.18]] as [number, number][]).map((p, i) => (
        <mesh key={`post-${i}`} position={[p[0], 0.95, p[1]]}>
          <boxGeometry args={[0.05, 0.9, 0.05]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.42, 0.07]}>
        <boxGeometry args={[0.68, 0.05, 0.85]} />
        <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* mast rails, raised toward the load side */}
      {[-0.26, 0.26].map((mx, i) => (
        <mesh key={`mast-${i}`} position={[mx, 1.0, 0.62]}>
          <boxGeometry args={[0.06, 2.0, 0.06]} />
          <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* forks */}
      {[-0.18, 0.18].map((fx, i) => (
        <mesh key={`fork-${i}`} position={[fx, 0.1, 1.0]}>
          <boxGeometry args={[0.1, 0.05, 0.65]} />
          <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* beacon light */}
      <mesh position={[0, 1.5, -0.05]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

function PathTrails() {
  const forklifts = useActiveWarehouse().forklifts;
  return (
    <>
      {forklifts.map((fl) => {
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
  const warehouse = useActiveWarehouse();
  const allRacks = useMemo(
    () => warehouse.zones.flatMap((z) => z.aisles.flatMap((a) => a.racks.map((r) => ({ rack: r, color: z.color, zoneId: z.id })))),
    [warehouse],
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
